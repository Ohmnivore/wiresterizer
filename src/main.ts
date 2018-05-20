// Ugly hack to force early math classes declaration
/// <reference path="tsm/tsm.ts"/>

// Ugly hack to force early Renderer class declaration
/// <reference path="renderer.ts"/>

// Ugly hack to force early Model class declaration
/// <reference path="model.ts"/>

// Ugly hack to force early model array declaration
/// <reference path="cube.ts"/>

// Init variables
let canvasID = "wiresterizer";
let frameRate = 60.0;
let bgValue = 0x00;     // black
let wireValue = 0xFF;   // white


// Create renderer
let canvas = element(canvasID) as HTMLCanvasElement;
let renderer = new WireRenderer(canvas, frameRate, bgValue, wireValue);


// Setup scene (-Z forward, Y up)
renderer.camera.setPerspective(45, renderer.screenAspectRatio, 0.01, 10000.0);

renderer.camera.position.x = 0.0;
renderer.camera.position.y = 0.0;
renderer.camera.position.z = 3.0;

renderer.camera.target.x = 0.0;
renderer.camera.target.y = 0.0;
renderer.camera.target.z = 0.0;

renderer.camera.useDirection = false;

let cube = new WireModel(array_cube)
renderer.models.push(cube)

cube.pos.x = 0;
cube.pos.y = 0;
cube.pos.z = 0;
cube.updateMat();


///////////////////////////////////////////////////////////////////////////////
// HTML Helpers

function element(id: string): HTMLElement {
    let ret = document.getElementById(id);
    if (ret == undefined) {
        alert("Element with ID " + id + " not found.");
        return new HTMLElement(); // Tricking TypeScript's strict null check
    }
    else {
        return ret;
    }
}
