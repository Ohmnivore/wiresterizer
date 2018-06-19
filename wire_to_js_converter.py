#!/usr/bin/env python
# -*- coding: utf-8 -*-

OUTPUT_FILE_EXTENSION = '.ts'

# 32-bit float, little-endian
ELEMENT_SIZE = 4
ELEMENT_FORMAT = '<f'


def main(argv):

    import os
    import struct

    # Print usage if wrong amount of command line arguments
    argc = len(argv)
    if argc != 3:
        print('Usage: wire_to_js_converter <*.wire file> <output directory>')
        exit(1)

    # Parse command line arguments
    wire_path = argv[1]
    out_path = argv[2]
    wire_size = os.path.getsize(wire_path)
    base_filename, _file_extension = os.path.splitext(os.path.basename(wire_path))
    output_path = os.path.join(out_path, base_filename + OUTPUT_FILE_EXTENSION)

    with open(wire_path, "rb") as wire_file:
        with open(output_path, "w", encoding="utf8", newline="\n") as output_file:

            output_file.write('var array_%s = new Float32Array(%d);\n' % (base_filename, wire_size / ELEMENT_SIZE))

            # Read four bytes at a time
            idx = 0
            byte = wire_file.read(ELEMENT_SIZE)
            while byte:
                value = struct.unpack(ELEMENT_FORMAT, byte)[0]
                output_file.write('array_%s[%d] = %f;\n' % (base_filename, idx, value))

                byte = wire_file.read(ELEMENT_SIZE)
                idx += 1


if __name__ == '__main__':
    import sys
    main(sys.argv)
