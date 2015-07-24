var Viz = {}

Viz.setup = function(container, data_people, data_references, data_characteristics) {

  //get the page ready
  Viz.setup_elements(container);

  Viz.data_people = data_people;
  Viz.data_references = data_references;
  Viz.data_characteristics = data_characteristics;
  console.log(Viz.data_people)
  //set the graph type
  //Viz.data_type = 'PeopleMap';
  Viz.data_type = $('#map-types option:selected').attr('data-map-type');

  Viz.diameter = $(container).width(),
  Viz.radius = Viz.diameter / 2,
  Viz.innerRadius = Viz.radius - 175;

  Viz.cluster = d3.layout.cluster()
      .size([360, Viz.innerRadius])
      .sort(comparator)
      .value(function(d) { return d.size; });

  Viz.bundle = d3.layout.bundle();

  Viz.line = d3.svg.line.radial()
      .interpolate("bundle")
      .tension(.85)
      .radius(function(d) { return d.y; })
      .angle(function(d) { return d.x / 180 * Math.PI; });


  Viz.svg = d3.select(container).append("svg")
      .attr("class","viz")
      .attr("width", Viz.diameter)
      .attr("height", Viz.diameter)
    .append("g")
      .attr("transform", "translate(" + Viz.radius + "," + (Viz.radius - 50) + ")");

  Viz.color = d3.scale.category20();

  Viz.text_color = '#333333';

  Viz.link = Viz.svg.append("g").selectAll(".link"),
  Viz.node = Viz.svg.append("g").selectAll(".node");

  Viz.similarity_types = similarity_types();
  Viz.setup_similarity_types();
  Viz.setup_interactions();
  Viz.load_data();
  
} //setup

Viz.setup_elements = function(container) {

  Viz.container = container;
  Viz.sidebar = $('#right-sidebar');

  //hide the checkboxes for the characteristics set
  $('#similarity-types .references').hide();
  $('#similarity-types .people').hide();

  $(Viz.container).append('<div id="viz-loading"><span class="loading"></span></div>');

}//setup_elements


Viz.setup_interactions = function() {

  $('#node-search').change(function() {

  })

  $('#right-sidebar').on('click', '.expand', function() {
    if ($(this).hasClass('collapse-toggle')) {
      $(this).closest('div').find('.not-hidden').removeClass('not-hidden');
        $(this).html('Expand').removeClass('collapse-toggle');
    } else {
      $(this).closest('div').find('.collapsed').addClass('not-hidden');
      $(this).html('Collapse').addClass('collapse-toggle');
    }
  })//expand clicks

  $('#similarity-types input').change(function() {

    $('#viz-loading').show();

    //If they uncheck all the boxes, check the first one...
    if ($('#similarity-types input[type="checkbox"]:not(:checked)').length >= $('#similarity-types input[type="checkbox"]:visible').length) {
      $('#similarity-types input[type="checkbox"]:visible:first').prop('checked',true);
    }

    Viz.load_data();
  
  })

  $('#map-types').change(function() {
    
    $('#viz-loading').show();
    
    Viz.clear_sidebar(); // removes all <p>s

    Viz.data_type = $('#map-types option:selected').attr('data-map-type');

    if (Viz.data_type == 'CharacteristicsMap') {
      $('#similarity-types label').hide().children('input').prop('checked', false);
      $('#similarity-types .people, #similarity-types .references').show().children('input').prop('checked', true);
    } else {
      $('#similarity-types label').show().children('input').prop('checked', true);
      $('#similarity-types .people, #similarity-types .references').hide().children('input').prop('checked', false);
    }
    
    $('#right-sidebar .attribute_holder').hide();
    $('#right-sidebar .' + Viz.data_type).show();
    Viz.load_data();

  });

}//setup_interactions


Viz.setup_similarity_types = function() {
  for (var i = 0; i < Viz.similarity_types.length; i++) {
    $('#similarity-types input').each(function() { $(this).prop('checked', true)});
  }//foreach similarity type
}//setup_similarity_types



Viz.load_data = function(data_type) {

  if (Viz.data_type == "PeopleMap") {

    //load people data
    //

    d3.json(Viz.data_people==null?"/ScholarMap/api/v1/people/graphs/force-directed":Viz.data_people, function(error, data) {
      console.log("I have retrieved data");

      Viz.attributes = data.attributes;
      Viz.fields = Viz.attributes.fields;
      Viz.methods = Viz.attributes.methods;
      Viz.references = Viz.attributes.references;
      Viz.theories = Viz.attributes.theories;
      Viz.venues = Viz.attributes.venues;

      Viz.originalNodes = data.nodes;

      Viz.groupedNodes = {
        name: "root",
        display: false,
        children: []
      };

      Viz.load_viz();

    })

  }//if people

  else if (Viz.data_type == "ReferencesMap") {

    //load ref data
    d3.json(Viz.data_references==null?"/ScholarMap/api/v1/references/graphs/force-directed":Viz.data_references, function(error, data) {

      Viz.attributes = data.attributes;
      Viz.fields = Viz.attributes.fields;
      Viz.methods = Viz.attributes.methods;
      Viz.references = Viz.attributes.references;
      Viz.theories = Viz.attributes.theories;
      Viz.venues = Viz.attributes.venues;

      Viz.originalNodes = data.nodes;

      Viz.groupedNodes = {
        name: "root",
        display: false,
        children: []
      };

      Viz.load_viz();

    })

  }//else refs

  else if (Viz.data_type == "CharacteristicsMap") {

    //load ref data
    d3.json(Viz.data_references==null?"/ScholarMap/api/v1/characteristics/graphs/force-directed":Viz.data_characteristics, function(error, data) {

      Viz.attributes = data.attributes;
      Viz.fields = Viz.attributes.fields;
      Viz.methods = Viz.attributes.methods;
      Viz.references = Viz.attributes.references;
      Viz.theories = Viz.attributes.theories;
      Viz.venues = Viz.attributes.venues;
      Viz.people = Viz.attributes.people;


      Viz.originalNodes = data.nodes;

      Viz.groupedNodes = {
        name: "root",
        display: false,
        children: []
      };

      Viz.load_viz();

    })

  }//else refs


} //load_data



Viz.load_viz = function() {

    console.log("loading viz");

    Viz.filteredLinks = Viz.generate_links(Viz.originalNodes, "objects");

    if (Viz.filteredLinks.length >0) {

        //Make a list of all the nodes that are currently active...
        Viz.active_sources = Viz.filteredLinks.map(function (n) {
            return n.source.relative_url;
        })

        Viz.active_targets = Viz.filteredLinks.map(function (n) {
            return n.target.relative_url;
        })

        Viz.active_nodes = Viz.active_targets.concat(Viz.active_sources);
        Viz.active_nodes = arrayUnique(Viz.active_nodes);

        //Filter original nodes to only include those used in the filtered links

        Viz.filteredNodes = Viz.originalNodes.filter(function (d) {
            return Viz.active_nodes.indexOf(d.relative_url) > -1
        })

        Viz.communityLinks = Viz.generate_links(Viz.originalNodes, "ids");

        //make a list of node names to use in the community detection algorithm
        Viz.node_names = Viz.active_nodes;

        //generate communities

        var community = jLouvain().nodes(Viz.active_nodes).edges(Viz.communityLinks);

        Viz.community = community();
        console.log(Viz.community);
        //get the groups from the community
        var groups = $.map(Viz.community, function (value, index) {
            return [value];
        });

        groups = arrayUnique(groups);

        //add new nodes for each group with children...
        //this just uses the relative_url ... will see if that works...
        var tmp_counter = 0;
        $.each(groups, function (d) {
            tmp_children = [];
            var tmp_group = d;

            //foreach realtive url
            $.each(Viz.community, function (index, value) {

                //if that node is in the current group...
                if (value == tmp_group) {

                    //loop through the existing objects and find the correct node...
                    for (var i = 0; i < Viz.originalNodes.length; i++) {
                        if (Viz.originalNodes[i]['relative_url'] == index) {
                            var tmp_object = Viz.originalNodes[i];
                        }
                    }

                    tmp_children.push(tmp_object);
                }
            });

            tmp_node = {
                name: d,
                relative_url: "group_" + d,
                display: false,
                children: tmp_children
            };

            Viz.groupedNodes.children[tmp_counter] = tmp_node;
            tmp_counter++;

        });

        //Generate the clustered nodes
        Viz.clusteredNodes = Viz.cluster.nodes(Viz.groupedNodes);
    }
    //Update the viz
    Viz.update();

  }// load_viz

Viz.clear_sidebar = function() {
  Viz.sidebar.find('p').remove();
  Viz.sidebar.find('.name_holder h4').remove();
}

Viz.update = function() {

  $('#viz-loading').fadeOut('slow');
  if (Viz.filteredLinks.length >0) {
      //kill everything? ... yes, kill everything
      Viz.link = Viz.svg.selectAll(".link").remove();
      Viz.node = Viz.svg.selectAll(".node").remove();

      Viz.link = Viz.svg.append("g").selectAll(".link"),
          Viz.node = Viz.svg.append("g").selectAll(".node");

      Viz.link = Viz.link
          .data(Viz.bundle(Viz.filteredLinks));

      //console.log(Viz.filteredLinks);

      Viz.link.enter()
          .append("path")
          //.each(function(d) { d.source = d[0], d.target = d[d.length - 1]; })
          .attr("class", "link")
          .attr("d", Viz.line);

      Viz.link.exit().remove();

      //Group nodes and root get display: false
      Viz.node = Viz.node
          .data(Viz.clusteredNodes.filter(function (n) {
                  return n.display !== false;
              }
          ));

      //This is the optional function that you add to the data function to bind the data by a custom attribute ... which is what you need to do to animate things....

      //, function(d, i) { return d.relative_url; }

      Viz.node.enter().append("text")
          .attr("class", "node")
          .attr("fill", function (d) {
              return Viz.color(d.parent.name);
          })
          .attr("dy", ".31em")
          .attr("transform", function (d) {
              return "rotate(" + (d.x - 90) + ")translate(" + (d.y + 8) + ",0)" + (d.x < 180 ? "" : "rotate(180)");
          })
          .style("text-anchor", function (d) {
              return d.x < 180 ? "start" : "end";
          })
          .text(function (d) {
              if (Viz.data_type == 'PeopleMap' || Viz.data_type == 'CharacteristicsMap') {
                  return d.name.trunc(50);
              } else if (Viz.data_type == 'ReferencesMap') {
                  return d.citationShort.trunc(50);
              }
          })
          .on("click", Viz.mouseclick)
          .on("mouseover", Viz.mouseovered)
          .on("mouseout", Viz.mouseouted);

      Viz.node.exit().remove();
  } else {
      $('svg').remove();
      $(Viz.container).append("<div id='nolinks' class='jumbotron'><p>No Links To Display</p></div>");
  }

} //update

Viz.mouseclick = function(d) {

  Viz.clear_sidebar();

  var main_link = d.relative_url;
  var people_name;
  var people_position;
  var people_institution;
  var people_string = ""

  for (key in d) {

   if (key === "citation") {
      if (d[key] != "") {
         Viz.sidebar.find('.' + key).append("<p><a class='node-attribute' href='" + main_link + "'>" + d[key] + "</a></p>");
      }
    }

    //name for characteristics
   if (key === "name" && !_.has(d, 'institution')) {
      if (d[key] != "") {
         Viz.sidebar.find('.' + key).append("<p><a class='node-attribute' href='" + main_link + "'>" + d[key] + "</a></p>");
      }
    } 
    //name for people
    else if (key === "name" && _.has(d, 'institution')) {
      if (d[key] != "") {
        people_name = d[key];
      }
    }

    if (key === "institution") {
      if (d[key] != "") {
        people_institution = d[key];
      }      
    }

    if (key === "position") {
      if (d[key] != "") {
        people_position = d[key];
      }      
    }

   if (key === "department" || key === "authors" || key === "year") {
      if (d[key] != "") {
         Viz.sidebar.find('.' + key).append("<p><a class='node-attribute'>" + d[key] + "</a></p>");
      }
    }

    if (key === "references" && d[key].length > 0) {

      attribute_holder = Viz.references;
      var tmp_fields = "";
      var hide = "";
      for (var i = 0; i < d[key].length; i++) {
        if (i > 4) {
          var hide = " collapsed";
        }

        //Hopefully this turns into something other than undefined once the json file gets updated. 
        tmp_fields += "<a class='node-attribute" + hide + "' href='" + attribute_holder[d[key][i].id].relative_url + "'>" + attribute_holder[d[key][i].id].citationShort + "</a>";
      }
      Viz.sidebar.find('.' + key).append("<p>" + tmp_fields + "</p>");
      if (hide != "") {
        Viz.sidebar.find('.' + key + ' p').append('<a class="node-attribute expand">Expand</a>');        
      }
    }

    var attribute_holder = "";

    if (key === 'fields' && d[key].length > 0) {
      attribute_holder = Viz.fields;
    } else if (key === 'methods' && d[key].length > 0) {
      attribute_holder = Viz.methods;
    } else if (key === 'theories' && d[key].length > 0) {
      attribute_holder = Viz.theories;
    } else if (key === 'venues' && d[key].length > 0) {
      attribute_holder = Viz.venues;
    } else if (key === 'people' && d[key].length > 0) {
      attribute_holder = Viz.people;
    }

    if (attribute_holder) {
      var tmp_fields = "";
      var hide = "";
      for (var i = 0; i < d[key].length; i++) {
        if (i > 4) {
          var hide = " collapsed";
        }
        tmp_fields += "<a class='node-attribute" + hide + "' href='" + attribute_holder[d[key][i]].relative_url + "'>" + attribute_holder[d[key][i]].name + "</a>";
      }
      Viz.sidebar.find('.' + key).append("<p>" + tmp_fields + "</p>");
      if (hide != "") {
        Viz.sidebar.find('.' + key + ' p').append('<a class="node-attribute expand">Expand</a>');       
      }
    }//if adding a list
  }

    if (people_name || people_position || people_institution) {
      people_string = "<h4>";
      if (people_name) {
        people_string += "<a href='" + main_link + "'>" + people_name + "</a>";
      }
      if (people_position || people_institution) {
        people_string += "<br /><span>"
      }
      if (people_position) {
        people_string += people_position;
      }
      if (people_institution) {
        if (people_position) {
          people_string += ", ";
        }
        people_string += people_institution;
      }
      if (people_position || people_institution) {
        people_string += "</span>"
      }
      people_string += "</h4>"
      Viz.sidebar.find('.name_holder').append(people_string);
    }

}//mouseclick

Viz.mouseovered = function(d) {

  Viz.node.each(
    function(n) { n.target = n.source = false; }
  );

  Viz.link
    .classed("link--target", function(l) { 
      //console.log(l);
      var tmp_return = false;
      //Links have some junk elements (e.g., root) for some reason,
      //so loop through and test the others
      for (var i = 0; i <= l.length; i++) {
        if (!_.has(l[i], 'display') && _.has(l[i], 'relative_url')) {
          if (l[i].relative_url == d.relative_url) {
            return true;
          }             
        }
      }
    });

    Viz.svg.selectAll("path").sort(function (a, b) { 
      var active = false;
      for (var i = 0; i < a.length; i++) {
        if (a[i].relative_url == d.relative_url) {
          active = true;
          break;
        }
      }
      if (!active) { return -1; }
      else { return 1; }
    });


    Viz.node
        .classed("node--target", function(n) { return n.target; })
        .classed("node--source", function(n) { return n.source; });

}

Viz.mouseouted = function(d) {
  Viz.link
      .classed("link--target", false)
      .classed("link--source", false);

  Viz.node
      .classed("node--target", false)
      .classed("node--source", false);
}


Viz.generate_links = function(nodes, return_type) {
    var active_types, links;
    louvain_communities_cache = void 0;
    active_types = active_similarity_types();

    links = _.map(nodes, function(n, index) {

        //Go through each node and all others to ook for links
        return _.slice(nodes, index + 1, nodes.length).map(function(other_node) {
            var any_links, j, len, node_attr_ids, other_node_attr_ids, similarities, similarity_type;
            similarities = {};
            any_links = false;
            for (j = 0, len = active_types.length; j < len; j++) {
                similarity_type = active_types[j];
                similarities[similarity_type] = n[similarity_type] && other_node[similarity_type] ? n[similarity_type] && typeof n[similarity_type][0] === 'object' ? (node_attr_ids = _.map(n[similarity_type], function(similarity) {
                    return similarity.id;
                }), other_node_attr_ids = _.map(other_node[similarity_type], function(similarity) {
                    return similarity.id;
                }), similarities[similarity_type] = _.map(_.intersection(node_attr_ids, other_node_attr_ids), function(id) {
                    var node_attr_weight, other_node_attr_weight;
                    node_attr_weight = _.find(n[similarity_type], function(item) {
                        return item.id === id;
                    }).weight;
                    other_node_attr_weight = _.find(other_node[similarity_type], function(item) {
                        return item.id === id;
                    }).weight;
                    return {
                        id: id,
                        weight: (node_attr_weight + other_node_attr_weight) / 2
                    };
                })) : (node_attr_ids = n[similarity_type], other_node_attr_ids = other_node[similarity_type], similarities[similarity_type] = _.map(_.intersection(node_attr_ids, other_node_attr_ids), function(id) {
                    return {
                        id: id,
                        weight: 50
                    };
                })) : [];
                if (similarities[similarity_type].length > 0) {
                    any_links = true;
                }
            }
            if (any_links) {
                if (return_type == "objects") {
                  return {
                      source: n,
                      target: other_node,
                      similarities: _.filter(_.map(active_types, function(similarity_type) {
                          return {
                              type: similarity_type,
                              list: similarities[similarity_type]
                          };
                      }), function(similarity) {
                          return similarity.list.length > 0;
                      })
                  };
                } else {
                  return {
                      source: n.relative_url,
                      target: other_node.relative_url,
                      similarities: _.filter(_.map(active_types, function(similarity_type) {
                          return {
                              type: similarity_type,
                              list: similarities[similarity_type]
                          };
                      }), function(similarity) {
                          return similarity.list.length > 0;
                      })
                    };
                }
            } else {
                return null;
            }
        });
    });
    links = _.compact(_.flatten(links));

    return _.sortBy(links, function(link) {
        return -link_weight(link);
    }).slice(0, +Math.floor(Viz.originalNodes.length * 6) + 1 || 9e9);

};

similarity_exclusions = function() {

    var tmp_exclusions = [];

    $('#similarity-types input[type="checkbox"]:not(:checked)').each(function(i) {
      tmp_exclusions[i] = $(this).val();
    });

    return tmp_exclusions;

};//similarity_exclusions


active_similarity_types = function() {

    return similarity_types().filter(function(type) {
        return similarity_exclusions().indexOf(type) < 0;
    });

};

similarity_types = function() {
    return ['fields', 'methods', 'theories', 'venues', 'references','people'];
};

link_index = function(d) {
    return d.source.index + "->" + d.target.index;
};

link_weight_cache = {};

link_weight = function(d) {
    var total_weight, weights;
    if (link_weight_cache[link_index(d)]) {
        return link_weight_cache[link_index(d)];
    }
    weights = _.flatten(d.similarities.map(function(similarity) {
        return similarity.list.map(function(item) {
            return item.weight;
        });
    }));
    total_weight = weights.reduce(function(a, b) {
        return a + b;
    });
    return link_weight_cache[link_index(d)] = total_weight;
};

function comparator(a, b) {
  return d3.ascending(a.name, b.name);
}

function arrayUnique(a) {
    return a.reduce(function(p, c) {
        if (p.indexOf(c) < 0) p.push(c);
        return p;
    }, []);
};

function filterByValue(obj) {
  console.log(obj);
  /*if ('id' in obj && typeof(obj.id) === 'number' && !isNaN(obj.id)) {
    return true;
  } else {
    invalidEntries++;
    return false;
  }
  */
}





String.prototype.trunc = String.prototype.trunc ||
      function(n){
          return this.length>n ? this.substr(0,n-1)+'...' : this;
      };




/**********************/




