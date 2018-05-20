class WireModel {

    public verts: Float32Array;
    public num_faces: number;

    constructor(verts: Float32Array) {
        this.verts = verts;
        this.num_faces = (verts.length / 3) / 4;
    }
}
