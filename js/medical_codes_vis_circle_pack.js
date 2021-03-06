function shadeColor(rgbColor, percent) {
    let colors = rgbColor.replace("rgb","").replace("(","")
        .replace(")","").split(",");

    var R = parseInt(colors[0]);
    var G = parseInt(colors[1]);
    var B = parseInt(colors[2]);

    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);

    R = (R<255)?R:255;
    G = (G<255)?G:255;
    B = (B<255)?B:255;

    var RR = ((R.toString(16).length==1)?"0"+R.toString(16):R.toString(16));
    var GG = ((G.toString(16).length==1)?"0"+G.toString(16):G.toString(16));
    var BB = ((B.toString(16).length==1)?"0"+B.toString(16):B.toString(16));

    return "#"+RR+GG+BB;
}


// ==================================== D3 ========================================

const svg = d3.select("svg");

const diameter = +svg.attr("width"),
    g = svg.append("g").attr("transform", "translate(" + diameter / 2 + "," + diameter / 2 + ")"),
    width = 800,
    height = 600;


const pack = d3.pack()
    .size([width, height - 50])
    .padding(10);

const tooltip = d3.select("body")
    .append("div")
    .style("position", "absolute")
    .style("z-index", "10")
    .style("visibility", "hidden")
    .style("background-color", "white")
    .style("border", "solid")
    .style("border-width", "2px")
    .style("border-radius", "5px").style("padding", "4px");

d3.json("data/icd10_full.json", function (error, root) {
    if (error) throw error;

    // Get maximal depth of the tree, to determine opacities of nodes.
    function getDepth(obj) {
        let depth = 0;
        if (obj.children) {
            obj.children.forEach(function (d) {
                const tmpDepth = getDepth(d);
                if (tmpDepth > depth) {
                    depth = tmpDepth
                }
            })
        }
        return 1 + depth
    }

    const maxDepth = getDepth(root);
    console.log("Hierarchy maximal depth is " + maxDepth);

    let codesFromList = false;

    let color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, root.children.length + 2));

    root = d3.hierarchy(root)
        .sum(function (d) {
            return d.value;
        })
        .sort(function (a, b) {
            return b.value - a.value;
        });

    let focus = root,
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

    let circle = g.selectAll("circle")
        .data(nodes)
        .enter().append("circle")
        .attr("class", function (d) {
            return d.parent ? d.children ? "node" : "node node--leaf" : "node node--root";
        })
        .style("fill", getColorByCategory)
        .style("stroke", function(d) {
            return shadeColor(getColorByCategory(d), -20);
        })
        .attr("fill-opacity", function (d) {
            // The deeper the node in the tree, the higher the opacity (which accumulates along the deeper layers)
            // We add 1 to the depth only so the root (depth=0) still has opacity>0.
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

    // Set constant minimum circle size
    // TODO: consider changing this so the minimum size depends on the specific hierarchy structure.
    circle.each(function(d) {
       if (d.r < 0.1) {
           d.r = 0.1;
       }
    });

    let text = g.selectAll("text")
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

    let node = g.selectAll("circle,text");

    svg.on("click", function () {
        if (focus.parent != null)  zoom(focus.parent);
    });
    g.on("click", function () {
        zoom(focus.parent);
    });

    zoomTo([root.x, root.y, root.r]);
	
	// Update Breadcrumbs
	let codePathElement = document.getElementById("code-path");
	codePathElement.innerHTML = "<b>You Are Here: </b> &rarr;" + root.data.name;

    // Three function that change the tooltip when user hover / move / leave a cell
    function mouseover(d) {
        let desc = "";
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
        let codePathElement = document.getElementById("code-path");
        codePathElement.innerHTML = "<b>You Are Here: </b> &rarr;" + root.data.name;
    }

    function isCodeOrItsDescendentInSet(d, codesSet) {
        // Non recursive DFS
        let nodesToVisit = [d];
        while (nodesToVisit.length > 0) {
            let currentNode = nodesToVisit.shift();
            if (codesSet.has(currentNode.data.name)) return true;

            if (currentNode.hasOwnProperty("children")  && currentNode.children.length > 0) {
                for (let c of currentNode.children) {
                    nodesToVisit.push(c);
                }
            }

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
        let child;
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
        let c;
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
                let interpolator = d3.interpolateZoom(view, [focus.x, focus.y, focus.r]);
                return function (t) {
                    zoomTo(interpolator(t));
                };
            });
    }

    function zoom(d) {
        console.log(focus);
        focus = d;
        if (!focus.children) {
            // We don't zoom in on leaves
            return;
        }

        let transition = zoomTransitionToFocus();

        let checkedCodes = getCheckedCodes();

        transition.selectAll("circle")
            .on("start", function (d) {
                // Hide non-descendents
                if (!isAncestor(focus, d) && d !== focus) {
                    this.style.display = "none";
                }
            })
            .on("end", function (d) {
                // Only display descendents of focus (and the focus node).
                if (isAncestor(focus, d) || d === focus) {
                    // If we are only viewing codes from a given list, make sure we don't display others.
                    if (codesFromList && !isCodeOrItsDescendentInSet(d, checkedCodes)) return;
                    this.style.display = "inline";
                }
        });

        transition.selectAll("text")
            .style("fill-opacity", function (d) {
                return d.parent === focus ? 1 : 0;
            })
            .on("start", function (d) {
                this.style.display = "none"
            })
            .on("end", function (d) {
                // TODO: make this animated with duration
                if (d.parent === focus) {
                    // TODO: consider removing text for codes that are not on the list
                    // Set font size according to zoomed in circles
                    let k = diameter / (focus.r * 2);
                    this.style.fontSize = ((d.r * k) / 2.2).toString() + "px";
                    if (codesFromList && !checkedCodes.has(d.data.name)) return;
                    this.style.display = "inline";
                }
            });

        // Update Breadcrumbs
        let codePathElement = document.getElementById("code-path");
        let codePath = "";
        let currentNode = focus;
        while (currentNode != null) {
            codePath = "&rarr;" + currentNode.data.name + codePath;
            currentNode = currentNode.parent;
        }
        codePathElement.innerHTML = "<b>You Are Here: </b>" + codePath;
    }

    function zoomTo(v) {
        let x = v[0],
            y = v[1],
            r = v[2];
        let k = diameter / (2 * r);
        view = v;
        node.attr("transform", function (d) {
            return "translate(" + (d.x - x) * k + "," + (d.y - y) * k + ")";
        });
        circle.attr("r", function (d) {
            return d.r * k;
        });
    }

    // ================================================ Search =========================================================

    function ChangeElementsDisplayByCheckbox(elements, box_name, box_checked) {
        elements.filter(d => d.data.name === box_name).each(function (d) {
            this.style.display = box_checked ? "inline" : "none";
        });
    }

    document.getElementById("searchbox").addEventListener("submit", function(event) {
        focus = root;
        // TODO: Simulate behavior as in "show codes from list": Allow zooming in while search query stays.
        // TODO: consider displaying all and only changing the colors.

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
        let searchResults = new Set();
        function getSearchResults(d) {
            let searchTerm;
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

        // Sort results
        let searchResultsArr = Array.from(searchResults);
        searchResultsArr.sort();

        console.log("Found " + searchResults.size + " results.");

        circle.each(function (d) {
            let shouldBeDisplayed = isCodeOrItsDescendentInSet(d,searchResults);
            this.style.display = shouldBeDisplayed ? "inline" : "none";

            // Set nodes that are not actually search results to gray.
            this.style.fill = searchResults.has(d.data.name) ? getColorByCategory(d) : "#E8E8E8";
        });



        // TODO: Currently only displays text for all results (including parent nodes),
        //  Change this so only displays text of top layer.
        setTextForCodesInSet(searchResults);

        resetView();

        let codesListContainer = document.getElementById("codes-from-input");
        // Delete previous children
        let child = codesListContainer.firstChild;
        while (child) {
            codesListContainer.removeChild(child);
            child = codesListContainer.firstChild;
        }

        // Append new children
        let c;
        for (c of searchResultsArr) {
            let checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.id = c + "-checkbox";
            checkbox.checked = true;
            checkbox.name = c;
            let label = document.createElement("label");
            label.htmlFor =  checkbox.id;
            label.appendChild(document.createTextNode(c));
            codesListContainer.appendChild(checkbox);
            codesListContainer.appendChild(label);
            codesListContainer.appendChild(document.createElement("br"));
            
            checkbox.addEventListener("change", function () {
                let box_name = this.name;
                let box_checked = this.checked;
                ChangeElementsDisplayByCheckbox(circle, box_name, box_checked);
                ChangeElementsDisplayByCheckbox(text, box_name, box_checked);
            });
        }
    });

    // ============================================ Show All Codes =====================================================
    function showAllCodes() {
        codesFromList = false;
        // Delete all checkboxes
        let codesListContainer = document.getElementById("codes-from-input");
        let child = codesListContainer.firstChild;
        while (child) {
            codesListContainer.removeChild(child);
            child = codesListContainer.firstChild;
        }
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

        // Clear search box
        document.getElementById("search-input").value = "";
    }

    document.getElementById("allcodes").addEventListener("click", showAllCodes);


});