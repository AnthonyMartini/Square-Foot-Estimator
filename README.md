# Square Footage Tool (Image Bounding Box)

A web-based React application that allows users to upload photos, auto-detect a physical reference marker, and draw polygons to instantly calculate real-world physical dimensions and square footage.

## Features

- **Reference Marker Auto-Detection**: Utilizes **OpenCV.js** to detect a specially designed 4-corner fiducial reference marker on uploaded images.
- **Sub-Pixel Precision**: Mathematical corner snapping ensures the reference bounds are pixel-perfect against the black marker shapes.
- **Perspective Distortion Correction**: Automatically computes a homography matrix to undistort the image math to a flattened top-down perspective, allowing for highly accurate measurements even when photos are taken at an angle.
- **Interactive Measurement Utilities**: Includes a "Polyline" tool that lets you draw shapes (e.g., walls, floors, irregular boundaries) on the image. As you draw, it calculates both area (Square Feet) and perimeter (Linear Feet) relative to the scale of the physical reference marker.
- **Real-Time Validation**: Projects and visually displays the calculated physical bounds right over the reference marker image to ensure calibration succeeded correctly.

## Tech Stack

- **React 19**: Component-based UI framework
- **Vite 7**: Ultra-fast development build tool
- **OpenCV.js**: Computer vision logic handling the contour detection, sub-pixel corner refinement, and homography (perspective transformation) mathematics.
- **Vanilla CSS**: Clean, responsive layout.

## Setup & Installation

Make sure you have [Node.js](https://nodejs.org/) installed on your machine.

1. Clone or download the repository.
2. Navigate to the project directory in your terminal:
   ```bash
   cd Image-Bounding-Box
   ```
3. Install the required Node dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to the localhost URL provided by Vite (e.g., `http://localhost:5173`).

## Usage Guide

You can find the integrated tutorial by clicking the **"How to Use"** button within the application. Here is a brief overview:

1. **Print the Reference Marker**: Print the 4-corner reference marker (provided in the app as a downloadable PDF). The application currently assumes the total width connecting the outer edges of the pattern is mathematically programmed in the system (e.g., exactly 6.5 inches across).
2. **Position and Photograph**: Place the printed marker on the wall, floor, or surface you wish to measure. Make sure all 4 inner black boxes on the reference pattern are clearly visible and unoccluded in the photo.
3. **Upload & Auto-Detect**: Upload the photo into the app. Click the **"Auto Detect"** button in the toolbar. The application will scan the image, find the reference markers, and draw transparent red polygons perfectly snapping over the fiducials.
4. **Draw to Measure**: Once calibration is successful, select the **Polyline** tool. Click around the region you wish to calculate. Double-click to close the shape. The app will immediately spit out the square footage area and linear perimeter!

## Future Enhancements
- Export functionality for saving measurement reports.
- Support for dynamically adjusting the scale of the reference marker.
- Mobile device orientation and image styling fixes.
