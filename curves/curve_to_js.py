#!/usr/bin/env python
# -*- coding: utf-8 -*-

OUTPUT_FILE_EXTENSION = '.ts'


def main(argv):

    import os
    from PIL import Image

    # Print usage if wrong amount of command line arguments
    argc = len(argv)
    if argc != 2:
        print('Usage: curve_to_js <image file>')
        exit(1)

    # Parse command line arguments
    wire_path = argv[1]
    base_filename, _file_extension = os.path.splitext(wire_path)
    base_filename = 'curve_' + base_filename
    output_path = os.path.join(os.path.dirname(wire_path), base_filename + OUTPUT_FILE_EXTENSION)

    # Read image
    img = Image.open(wire_path)
    img = img.convert("L")
    img_width = img.size[0]
    img_height = img.size[1]

    with open(output_path, "w", encoding="utf8", newline="\n") as output_file:

        table = []

        # Generate table
        for x in range(0, img_width):
            full_pixel_row_y = 0

            for y in range(0, img_height):
                pixel = img.getpixel((x, y))

                if pixel > 32:
                    full_pixel_row_y = y
                    break

            table.append(1.0 - (full_pixel_row_y / (img_height - 1)))

        # Fix inconsistencies at extremeties
        table[0] = 0.0
        table[len(table) - 1] = 1.0

        # Write table declaration
        output_file.write('var array_%s = new Float32Array(%d);\n' % (base_filename, len(table)))

        # Write table values
        for idx in range(0, len(table)):
            output_file.write('array_%s[%d] = %f;\n' % (base_filename, idx, table[idx]))


if __name__ == '__main__':
    import sys
    main(sys.argv)
