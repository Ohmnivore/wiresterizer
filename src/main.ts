// Ugly hack to force early Renderer class declaration
/// <reference path="renderer.ts"/>

// Ugly hack to force early model array declaration
/// <reference path="cube.ts"/>

// Init variables
let canvasID = "wiresterizer";
let frameRate = 60.0;
let bgValue = 0x00;     // black
let wireValue = 0xFF;   // white


// Create renderer
let canvas = element(canvasID) as HTMLCanvasElement;
let renderer = new Renderer(canvas, frameRate, bgValue, wireValue);


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
