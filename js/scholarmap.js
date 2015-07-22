var Viz = {}

Viz.setup = function(diameter, data, controls) {

  Viz.data = data;
  Viz.cotrols = controls;

  Viz.diameter = diameter,
  Viz.radius = Viz.diameter / 2,
  Viz.innerRadius = Viz.radius - 280;

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

  Viz.svg = d3.select("body").append("svg")
      .attr("class","viz")
      .attr("width", Viz.diameter)
      .attr("height", Viz.diameter)
    .append("g")
      .attr("transform", "translate(" + Viz.radius + "," + Viz.radius + ")");

      //http://www.creepyed.com/2011/12/windows-phone-colors-in-rgb-hex-values/

  Viz.colors = ["#9C5100", "#ff0094", "#00aaad", "#8cbe29", "#e671b5", "#ef9608", "#19a2de", "#e61400", "#319a31", ];

  Viz.color = d3.scale.category20();

  Viz.text_color = '#333333';

  Viz.link = Viz.svg.append("g").selectAll(".link"),
  Viz.node = Viz.svg.append("g").selectAll(".node");

  Viz.similarity_types = similarity_types();
  Viz.setup_similarity_types();
  Viz.setup_interactions();
  Viz.load_data();

  Viz.link_map = [];
  
} //setup


Viz.setup_interactions = function() {

  $('#similarity-types input').change(function() {
    console.log("Updating...");

    //If they uncheck all the boxes, check the first one...
    if ($('#similarity-types input[type="checkbox"]:not(:checked)').length >= $('#similarity-types input[type="checkbox"]').length) {
      $('#similarity-types input[type="checkbox"]:first').prop('checked',true);
    }
    Viz.load_data();
  })

}//setup_interactions


Viz.setup_similarity_types = function() {
  for (var i = 0; i < Viz.similarity_types.length; i++) {
    $('#similarity-types').append('<input type="checkbox" checked="checked" value="' + Viz.similarity_types[i] + '">' + Viz.similarity_types[i] + '</checkbox>');
  }//foreach similarity type
}//setup_similarity_types



Viz.load_data = function() {

  d3.json(Viz.data, function(error, data) {

    Viz.originalNodes = data.nodes;

    Viz.groupedNodes = {
      name: "root",
      display: false,
      children: []
    };

    Viz.load_viz();

  })

} //load_data



Viz.load_viz = function() {

    Viz.filteredLinks = generate_links(Viz.originalNodes, "objects");

    //Make a list of all the nodes that are currently active...
    Viz.active_sources = Viz.filteredLinks.map(function(n) {
      return n.source.relative_url;
    })

    Viz.active_targets = Viz.filteredLinks.map(function(n) {
      return n.target.relative_url;
    })

    Viz.active_nodes = Viz.active_targets.concat(Viz.active_sources);
    Viz.active_nodes = arrayUnique(Viz.active_nodes);

    console.log("Currently active nodes: " + Viz.active_nodes.length);  

    //Filter original nodes to only include those used in the filtered links

    Viz.originalNodes = Viz.originalNodes.filter(function(d) {
      return Viz.active_nodes.indexOf(d.relative_url) > -1
    })

    Viz.communityLinks = generate_links(Viz.originalNodes, "ids"); 

    //make a list of node names to use in the community detection algorithm
    Viz.node_names = Viz.active_nodes;

    //generate communities

    var community = jLouvain().nodes(Viz.active_nodes).edges(Viz.communityLinks);

    Viz.community = community();

    //get the groups from the community
    var groups = $.map(Viz.community, function(value, index) {
      return [value];
    });

    groups = arrayUnique(groups);

    //add new nodes for each group with children...
    //this just uses the relative_url ... will see if that works...
    var tmp_counter = 0;
    $.each(groups, function(d) {
      tmp_children = [];
      var tmp_group = d;
      
      //foreach realtive url
      $.each(Viz.community, function(index, value) {

        //if that node is in the current group...
        if (value == tmp_group) {

          //loop through the existing objects and find the correct node...
          for(var i=0; i<Viz.originalNodes.length; i++) {
            if (Viz.originalNodes[i]['relative_url'] ==  index) {
              var tmp_object = Viz.originalNodes[i];
              //console.log(tmp_object);
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

    //Update the viz
    Viz.update();

  }// load_viz

Viz.update = function() {

  //kill everything?
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
      .data(Viz.clusteredNodes.filter( function(n) { 
        return n.display !== false; } 
      ));

      //, function(d, i) { return d.relative_url; }
    
  Viz.node.enter().append("text")
      .attr("class", "node")
      .attr("fill", function(d) {
        return Viz.color(d.parent.name);
      })
      .attr("dy", ".31em")
      .attr("transform", function(d) { return "rotate(" + (d.x - 90) + ")translate(" + (d.y + 8) + ",0)" + (d.x < 180 ? "" : "rotate(180)"); })
      .style("text-anchor", function(d) { return d.x < 180 ? "start" : "end"; })
      .text(function(d) { return d.name; })
      .on("mouseover", mouseovered)
      .on("mouseout", mouseouted);

  Viz.node.exit().remove();

} //update

function mouseovered(d) {

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
    })


  Viz.node
      .classed("node--target", function(n) { return n.target; })
      .classed("node--source", function(n) { return n.source; });

}

function mouseouted(d) {
  Viz.link
      .classed("link--target", false)
      .classed("link--source", false);

  Viz.node
      .classed("node--target", false)
      .classed("node--source", false);
}


generate_links = function(nodes, return_type) {
    var active_types, links;
    louvain_communities_cache = void 0;
    active_types = active_similarity_types();

    console.log("Active similarity types: ");
    console.log(active_types);

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
    return ['fields', 'methods', 'theories', 'venues', 'references'];
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




/**********************/




$(document).ready(function() {

  Viz.setup(1000, "data/people.json");

});