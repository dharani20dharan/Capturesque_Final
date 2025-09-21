import React from "react";
import Hero from "./components/Hero";
import Intro from "./components/Intro";
import FeaturedPhotos from "./components/Featuredphotos";

const Home = () => {
  return (
    <>
      <Hero />
      <Intro />
      <FeaturedPhotos />
    </>
  );
};

export default Home;
