# Improvements

## Main Problem: Doesn't work properly unless the pdf and image taken are zoomed in as much as possible

Potential Solution: Instead of taking an image, the coordinates on the pdf are taken, then the backend can figure out mapping these coordinates to get the most accurate and detailed image from the pdf directly. PDF coordinate mapping and getting a detailed image from it could be done with PyMuPDF, pdf2image, and/or Pillow/OpenCV. Sending the pdf and coordinates to the backend (vs just an image) might slow the process down a bit but the accuracy gains will be much better.

## Getting Images

Getting images has a decent UX but it's very annoying on the large tables where we have to zoom out a lot (causing bad extraction) or take images of the tables in segments (annoying plus now we have to combine the different csv files).

Solutions:

- Problem will be majorly improved by solving the main problem (with the zoom).

- Creating a tool that auto-detects tables and then the user just has to click on the tables they want extracted. IMO, dragging to get an area vs clicking is a minor UX improvement that isn't worth the time creating and API cost of table detection - solving the main problem is a better fix.

- Creating a way to scroll through the pdf while in image capture mode to be able to take the image in one shot while still being zoomed in.

Also, the flow from capturing an image to extracting is okay but feels like there is just an extra click for no reason. We could just add a button that extracts all the selected image uploads at once and bundles them into a zip folder for the user.

## Dev Side

- Should have seperated the frontend component into different smaller components instead of making a huge file

- Add comments for clarity

- Commit in stages instead of committing everything at the end
