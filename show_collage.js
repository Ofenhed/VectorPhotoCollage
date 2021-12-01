const shadow_filter_id = "shadow-filter";
const svgNS = document.createElementNS("http://www.w3.org/2000/svg", "svg").namespaceURI;
const DOMUrl = window.URL || window.webkitURL || window;

function addShadows(svg) {
  let shadow_filter = svg.getElementById(shadow_filter_id);
  if (shadow_filter === null) {
    shadow_filter = document.createElementNS(svgNS, "filter");
    shadow_filter.id = shadow_filter_id;
    let offset = document.createElementNS(svgNS, "feOffset");
    offset.setAttribute("result", "offOut");
    offset.setAttribute("in", "SourceAlpha");
    offset.setAttribute("dx", 2);
    offset.setAttribute("dy", 2);
    shadow_filter.appendChild(offset);
    let blur = document.createElementNS(svgNS, "feGaussianBlur");
    blur.setAttribute("result", "blurOut");
    blur.setAttribute("in", "offOut");
    blur.setAttribute("stdDeviation", 2);
    shadow_filter.appendChild(blur);
    let blend = document.createElementNS(svgNS, "feBlend");
    blend.setAttribute("in", "SourceGraphic");
    blend.setAttribute("in2", "blurOut");
    blend.setAttribute("mode", "normal");
    shadow_filter.appendChild(blend);
    svg.getElementsByTagName("defs")[0].appendChild(shadow_filter);
  }
  let groups_with_shadow = svg.querySelectorAll("g#photos, g#postits");
  groups_with_shadow.forEach(group => {
    group.setAttribute("filter", "url(#" + shadow_filter_id + ")");
  });
}

function getBaseVal(from) {
  let baseVal = from.baseVal;
  if (baseVal !== undefined) {
    if (baseVal.value !== undefined) {
      return baseVal.value;
    }
    return baseVal[0].value;
  }
  return from;
}

function createFrame(id, x, y, width, height, thickness, color = '#fffaf5') {
    let border = document.createElementNS(svgNS, "rect");
    border.setAttribute("id", id);
    border.setAttribute("style", "fill: " + color + "; fill-rule: evenodd; stroke-width: 1;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;");
    border.setAttribute("x", getBaseVal(x) - thickness);
    border.setAttribute("y", getBaseVal(y) - thickness);
    border.setAttribute("width", getBaseVal(width) + thickness * 2);
    border.setAttribute("height", getBaseVal(height) + thickness * 2);
    return border;
}

function applyPostitFrames(svg, thickness) {
  let postits = svg.querySelectorAll("g#photos > text");
  let width = 0;
  let min_y = null;
  let max_y = null;
  postits.forEach(postit => {
    for (row in postit.children) {
      let child = postit.children.item(row);
      width = Math.max(width, child.getComputedTextLength());
      let child_y = getBaseVal(child.y);
      if (min_y === null || child_y < min_y) {
        min_y = child_y;
      }
      if (max_y === null || child_y > max_y) {
        max_y = child_y;
      }
    }
    let row_height = (max_y - min_y) / postit.children.length;
    let height = row_height * (postit.children.length + 1);
    let text_y = getBaseVal(postit.y) - row_height;
    let border = createFrame(postit.id + "_frame", postit.x, text_y, width, height, thickness, color = postit.style.stroke);
    postit.style.stroke = "";
    let text_transform = new DOMMatrix(postit.getAttribute("transform"));
    border.setAttribute("transform", text_transform);

    postit.parentNode.insertBefore(border, postit);
  });
}

function applyPhotoFrames(svg, thickness) {
  let images = svg.querySelectorAll("g#photos image");
  images.forEach(image => {
    image.decode();
    let shadow = document.createElementNS(svgNS, "rect");
    let clip = image.getAttribute("clip-path");
    if (clip === null) {
      clip = image;
    } else {
      let clip_ref = clip.match(/^url\((.*)\)$/);
      if (clip_ref !== null) {
        let clip_holder = svg.querySelector(clip_ref[1]);
        let clip_rects = clip_holder.getElementsByTagName("rect");
        if (clip_rects.length == 0) {
          clip = image;
        } else if (clip_rects.length == 1) {
          clip = clip_rects[0];
        } else {
          throw 'Too complicated clip for image: ' + image.href.baseVal
        }
      } else {
        throw 'Invalid clip for image: ' + image.href.baseVal
      }
    }
    let image_transform = new DOMMatrix(image.getAttribute("transform"));
    if (clip !== image) {
      let clip_transform = new DOMMatrix(clip.getAttribute("transform"));
      image_transform.multiplySelf(clip_transform);
    }
    let border = createFrame(image.id + "_frame", clip.x, clip.y, clip.width, clip.height, thickness);
    border.setAttribute("transform", image_transform);

    image.parentNode.insertBefore(border, image);
  });
}

function embedImages(svg) {
  var images = svg.querySelectorAll("image");
  var promises = [];
  images.forEach(image => {
    promises[promises.length] = new Promise((resolve, reject) => {
      fetch(image.href.baseVal).then(response => {
        response.blob().then(b => {
          var a = new FileReader();
          a.onload = function(e) {
            image.href.baseVal = e.target.result;
            resolve();
          };
          a.readAsDataURL(b);
        });
      });
    });
  });
  return Promise.all(promises);
}

function downloadPng(svg, width, height) {
  let xml = new XMLSerializer().serializeToString(svg);
  var canvas = document.createElement("canvas");
  var context = canvas.getContext("2d");
  var a = document.createElement("a");
  a.download = "collage.png";
  canvas.width = getBaseVal(svg.children[0].width);
  canvas.height = getBaseVal(svg.children[0].height);

  let image = new Image;
  var url = DOMUrl.createObjectURL(new Blob([xml], {type: 'image/svg+xml'}));
  image.onload = function() {
    DOMUrl.revokeObjectURL(url);
    context.fillStyle = "#ffffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0);

    a.href = canvas.toDataURL("image/png", 'collage.png');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }.bind(this);
  image.src = url;
}

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

document.getElementById("collage").addEventListener("load", function() { 
  applyPhotoFrames(this.contentDocument, 3); 
  applyPostitFrames(this.contentDocument, 5); 
  addShadows(this.contentDocument);
  embedImages(this.contentDocument).then(() => downloadPng(this.contentDocument));
});
