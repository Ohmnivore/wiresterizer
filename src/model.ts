class WireModel {

    verts: Float32Array;
    num_faces: number;

    pos: vec3;
    mat: mat4;

    constructor(verts: Float32Array) {
        this.verts = verts;

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

    updateMat() {
        this.mat.values[12] = this.pos.x;
        this.mat.values[13] = this.pos.y;
        this.mat.values[14] = this.pos.z;
    }
}
