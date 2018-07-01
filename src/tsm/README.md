This is a modified version of the TSM library by Matthias Ferch (https://github.com/matthiasferch/TSM).

# Modifications
* Removed the optional destination argument idiom (to avoid allocations and condition checks)
* Made the values array public
* Renamed confusing copy() function to copyTo()
* Added copyFrom() functions
* Added randomization utility class
* Removed some more allocations (temp vectors in lookAt)
