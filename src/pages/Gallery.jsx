import React from "react";

const Gallery = ({ isAuthenticated }) => {
  return (
    <div>
      <h1>Gallery</h1>
      {isAuthenticated ? (
        <p>Welcome back! Here are your photos.</p>
      ) : (
        <p>Please log in to view the gallery.</p>
      )}
    </div>
  );
};

export default Gallery;
