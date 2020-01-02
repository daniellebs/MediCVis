
var codesInput = new Set();
// document.getElementById('codesfile').onchange = function(){
//     var file = this.files[0];
//
//     var reader = new FileReader();
//     reader.onload = function(progressEvent){
//         console.log('Reading codes list from file ' + file.name);
//
//         let codes = new Set(this.result.split('\n'));
//         for (c of codes) {
//             c = c.replace(/\s+/g, '');
//             codesInput.add(c);
//         }
//
//         var codesListContainer = document.getElementById("codes-from-input");
//         // TODO: Set checkboxes according to their code hierarchy.
//         for (c of codesInput) {
//             var checkbox = document.createElement("input");
//             checkbox.type = "checkbox";
//             checkbox.id = c + "-checkbox";
//             checkbox.checked = true;
//             var label = document.createElement("label");
//             label.htmlFor =  checkbox.id;
//             label.appendChild(document.createTextNode(c));
//             codesListContainer.appendChild(checkbox);
//             codesListContainer.appendChild(label);
//             codesListContainer.appendChild(document.createElement("br"))
//         }
//     };
//     reader.readAsText(file);
//     document.getElementById("codesfile-label").innerText = file.name;
//
//     document.getElementById("allcodes").style.display = "inline";
//     document.getElementById("listcodes").style.display = "inline";


    // TODO: set a list of codes checkboxes
// };

// ==================================== D3 ========================================


var svg = d3.select("svg");

var margin = 20,
    diameter = +svg.attr("width"),
    g = svg.append("g").attr("transform", "translate(" + diameter / 2 + "," + diameter / 2 + ")"),
    width = 800,
    height = 600;


var pack = d3.pack()
    .size([width, height - 50])
    .padding(10);

var tooltip = d3.select("body")
    .append("div")
    .style("position", "absolute")
    .style("z-index", "10")
    .style("visibility", "hidden")
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "2px")
    .style("border-radius", "5px").style("padding", "4px");


d3.json("data/example.json", function (error, root) {
    if (error) throw error;

    // Get maximal depth of the tree, to determine opacities of nodes.
    function getDepth(obj) {
        var depth = 0;
        if (obj.children) {
            obj.children.forEach(function (d) {
                var tmpDepth = getDepth(d);
                if (tmpDepth > depth) {
                    depth = tmpDepth
                }
            })
        }
        return 1 + depth
    }

    maxDepth = getDepth(root);
    console.log("Hierarchy maximal depth is " + maxDepth);

    var codesFromList = false;

    let color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, root.children.length + 2));

    root = d3.hierarchy(root)
        .sum(function (d) {
            return d.value;
        })
        .sort(function (a, b) {
            return b.value - a.value;
        });

    var focus = root,
        nodes = pack(root).descendants(),
        view;

    function getColorByCategory(d) {
        if (d.depth === 0) {
            return color("root");
        }
        // Color circles by main category
        while (d.depth > 1) {
            d = d.parent;
        }
        return color(d.data.name);
    }

    var circle = g.selectAll("circle")
        .data(nodes)
        .enter().append("circle")
        .attr("class", function (d) {
            return d.parent ? d.children ? "node" : "node node--leaf" : "node node--root";
        })
        .style("fill", getColorByCategory)
        .attr("fill-opacity", function (d) {
            // The deeper the node in the tree, the higher the opacity.
            return (d.depth + 1) / (maxDepth + 5);
        })
        .attr("name", d => d.data.name)
        .on("click", function (d) {
            if (focus !== d) zoom(d);
            d3.event.stopPropagation();
        })
        // Set tooltip
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseleave", mouseleave);

    var text = g.selectAll("text")
        .data(nodes)
        .enter().append("text")
        .attr("class", "circle-label")
        .style("font-size", function (d) {
            // larger circles get larger fonts
            return (d.r/2.2).toString() + "px";
        })
        .style("fill-opacity", function (d) {
            return d.parent === root ? 1 : 0;
        })
        .style("display", function (d) {
            return d.parent === root ? "inline" : "none";
        })
        .text(function (d) {
            return d.data.name;
        });

    var node = g.selectAll("circle,text");

    svg.on("click", function () {
        zoom(focus.parent);
    });
    g.on("click", function () {
        zoom(focus.parent);
    });

    zoomTo([root.x, root.y, root.r * 2 + margin]);
	
	// Update Breadcrumbs
	var codePathElement = document.getElementById("code-path");
	codePathElement.innerHTML = "<b>You Are Here: </b> &rarr;" + root.data.name;

    // Three function that change the tooltip when user hover / move / leave a cell
    function mouseover(d) {
        var desc = "";
        if (d.data.hasOwnProperty("description")) {
            desc = ": " + d.data.description;
        }
        tooltip.text((d.data.name + desc)).style("visibility", "visible");
    }

    function mousemove(d) {
        tooltip.style("top", (event.pageY - 10) + "px").style("left", (event.pageX + 10) + "px");
    }

    function mouseleave(d) {
        tooltip.style("visibility", "hidden");
    }

    // ================================================ Utils ==========================================================
    function resetView() {
        // Zoom out
        focus = root;
        zoomTransitionToFocus();

        // Update Breadcrumbs
        var codePathElement = document.getElementById("code-path");
        codePathElement.innerHTML = "<b>You Are Here: </b> &rarr;" + root.data.name;
    }

    function isCodeOrItsDescendentInSet(d, codesSet) {
        // TODO: turn to iterative instead of recursive
        if (codesSet.has(d.data.name)) return true;
        if (!d.hasOwnProperty("children") || d.children.empty) return codesSet.has(d.data.name);
        var child;
        for (child of d.children) {
            if (codesSet.has(child.data.name) || isCodeOrItsDescendentInSet(child, codesSet)) return true;
        }
        return false;
    }

    function isAncestor(potentialParent, node) {
        if (node.depth <= potentialParent.depth) {
            return false;
        }
        while (node.depth >= 0) {
            if (node.data.name === potentialParent.data.name) {
                return true;
            }
            if (node.parent != null) {
                node = node.parent;
            } else {
                return false;
            }
        }
        return false;
    }

    function isChild(potentialChild, node) {
        if (potentialChild.depth <= node.depth || !node.children) {
            return false;
        }
        var child;
        for (child of node.children) {
            if (child.data.name === potentialChild.data.name) {
                return true;
            }
        }
        return false;
    }

    function setTextForCodesInSet(codesSet) {
        text.each(function (d) {
            if (codesSet.has(d.data.name)) {
                this.style.display = "inline";
                this.style.fillOpacity = 1;
                this.style.fontSize = (d.r / 2.2).toString() + "px";
            } else {
                this.style.display = "none";
                this.style.fillOpacity = 0;
            }
        });
    }

    function getCheckedCodes(checkedCodes) {
        checkedCodes = new Set();
        for (c of document.getElementById("codes-from-input").children) {
            if (c.tagName === "INPUT" && c.checked) {
                checkedCodes.add(c.id.split("-")[0]);
            }
        }
        return checkedCodes;
    }

    // ================================================= Zoom ==========================================================
    function zoomTransitionToFocus() {
        return d3.transition()
            .duration(750)
            .tween("zoom", function (d) {
                var i = d3.interpolateZoom(view, [focus.x, focus.y, focus.r * 2 + margin]);
                return function (t) {
                    zoomTo(i(t));
                };
            });
    }

    function zoom(d) {
        let targetDepth = d.depth;
        focus = d;
        if (!focus.children) {
            // We don't zoom in on leaves
            return;
        }

        var transition = zoomTransitionToFocus();

        transition.selectAll("circle")
            .on("start", function (d) {
                // Hide non-descendents
                if (!isAncestor(focus, d) && d !== focus) {
                    this.style.display = "none";
                }
                // If we are only viewing codes from input file, make sure we don't display others.
                if (codesFromList && !isCodeOrItsDescendentInSet(d, codesInput)) {
                    this.style.display = "none";
                }
            })
            .on("end", function (d) {
                // TODO: make this animated with duration
                // Only display descendents of focus (and the focus node).
                if (isAncestor(focus, d) || d === focus) {
                    // If we are only viewing codes from a given list, make sure we don't display others.
                    if (codesFromList && !isCodeOrItsDescendentInSet(d, codesInput)) return;
                    this.style.display = "inline";
                }
        });

        transition.selectAll("text")
            .style("fill-opacity", function (d) {
                return d.parent === focus ? 1 : 0;
            })
            .on("start", function (d) {
                // Hide non-children
                if (!isChild(d, focus) && d !== focus) {
                    this.style.display = "none";
                }
                // If we are only viewing codes from input file, make sure we don't display others.
                if (codesFromList && !isCodeOrItsDescendentInSet(d, codesInput)) {
                    this.style.display = "none";
                }
            })
            .on("end", function (d) {
                // TODO: make this animated with duration
                if (d.parent === focus) {
                    // Set font size according to zoomed in circles
                    let k = diameter / (focus.r * 2 + margin + 40);
                    this.style.fontSize = ((d.r/2.2) * k).toString() + "px";
                    if (codesFromList && !isCodeOrItsDescendentInSet(d, codesInput)) return;
                    this.style.display = "inline";
                }
            });

        // Update Breadcrumbs
        var codePathElement = document.getElementById("code-path");
        var codePath = "";
        var currentNode = focus;
        while (currentNode != null) {
            codePath = "&rarr;" + currentNode.data.name + codePath;
            currentNode = currentNode.parent;
        }
        codePathElement.innerHTML = "<b>You Are Here: </b>" + codePath;
    }

    function zoomTo(v) {
        var k = diameter / v[2];
        view = v;
        node.attr("transform", function (d) {
            return "translate(" + (d.x - v[0]) * k + "," + (d.y - v[1]) * k + ")";
        });
        circle.attr("r", function (d) {
            return d.r * k;
        });
    }

    // ================================================ Search =========================================================

    document.getElementById("searchbox").addEventListener("submit", function(event) {
        focus = root;
        // TODO: Simulate behavior as in "show codes from list" - creaate an "or" search based on search terms

        codesFromList = true;

        event.preventDefault();

        let input = document.getElementById('search-input');

        if (input.value.trim() === "") {
            showAllCodes();
            return;
        }

        let lowerCaseSearchInput = input.value.toLowerCase();
        let searchTerms = lowerCaseSearchInput.split(/[ ,\n]+/);

        /**
         * @return {boolean}
         */
        var searchResults = new Set();
        function getSearchResults(d) {
            for (searchTerm of searchTerms) {
                if ((d.data.hasOwnProperty("description") &&
                    d.data.description.toLocaleLowerCase().includes(searchTerm)) ||
                    (d.data.name.toLocaleLowerCase().includes(searchTerm))) {
                    searchResults.add(d.data.name);
                }
            }
        }

        // TODO: find a nicer way
        circle.each(d => getSearchResults(d));

        circle.style("display",
            d => searchResults.has(d.data.name) || d.depth === 0 ? "inline" : "none");

        // TODO: Currently only displays text for all results (including parent nodes),
        //  Change this so only displays text of top layer.
        setTextForCodesInSet(searchResults);

        resetView();
    });

    // =============================================== Code List =======================================================
    function showAllCodes() {
        codesFromList = false;
        console.log("Resetting view.");

        circle.each(function (d) {
            this.style.fill = getColorByCategory(d);
            this.style.display = "inline";
        });

        text.each(function (d) {
            let isFirstLayer = d.parent === root;
            this.style.fillOpacity =  isFirstLayer ? 1 : 0;
            this.style.display = isFirstLayer ? "inline" : "none";
        });

        resetView();
    }

    function showListCodes() {
        codesFromList = true;
        console.log("Showing codes from input file.");
        document.getElementById("allcodes").disabled = false;

        var checkedCodes = getCheckedCodes();
        console.log(checkedCodes);

        // Display circles for codes from list
        circle.each(function (d) {
            if (isCodeOrItsDescendentInSet(d, checkedCodes)) {
                let checkbox = document.getElementById(d.data.name + "-checkbox");
                console.log("Displaying code " + d.data.name);
                this.style.display = "inline";
                this.style.fill = (checkbox != null && checkbox.checked) ? "#DD5A43" : "#94A5BC";
            } else {
                this.style.display = "none";
            }
        });

        // Display text for codes from list
        setTextForCodesInSet(checkedCodes);

        resetView();
    }

    document.getElementById("allcodes").addEventListener("click", showAllCodes);


});