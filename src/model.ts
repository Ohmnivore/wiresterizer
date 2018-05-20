class WireModel {

    public verts: Float32Array;
    public num_faces: number;

    public pos: vec3;
    public mat: mat4;

    constructor(verts: Float32Array) {
        this.verts = verts;

        // Quads
        // this.num_faces = (verts.length / 3) / 4;

        // N-gons
        this.num_faces = 0;
        let idx = 0;
        while (idx < verts.length) {
            let verts_in_face = verts[idx];
            idx += verts_in_face * 3;
            idx++;
            this.num_faces++;
        }

        this.pos = new vec3();
        this.mat = new mat4();
        this.mat.setIdentity();

        this.updateMat();
    }

    public updateMat() {
        this.mat.values[12] = this.pos.x;
        this.mat.values[13] = this.pos.y;
        this.mat.values[14] = this.pos.z;
    }
}
