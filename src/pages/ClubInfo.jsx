import React from 'react';
// Import Instagram icon
import { FaInstagram } from 'react-icons/fa';
import './ClubInfo.css'; // Ensure CSS filename matches

const ClubInfo = () => {
  // Club Heads Data (Unchanged)
  const clubHeads = [
    {
      name: "Dharanidharan",
      photo: "/Members/member1.jpg",
      quote: "Photography is the story I fail to put into words.",
      instagram: "@this_is_dharanidharan",
      instaLink: "https://www.instagram.com/this_is_dharanidharan",
    },
    {
      name: "Another Club Head",
      photo: "/Members/clubhead2.jpg",
      quote: "Every picture tells a story, let's capture it.",
      instagram: "@another_clubhead",
      instaLink: "https://www.instagram.com/another_clubhead",
    },
  ];

  // Core Committee Data (Unchanged)
  const coreCommittee = [
    { name: "Dharanidharan",
      photo: "/Members/member1.jpg",
      quote: "Photography is the story I fail to put into words.",
      instagram: "@this_is_dharanidharan",
      instaLink: "https://www.instagram.com/this_is_dharanidharan"},
    { name: "Core Member 2", photo: "/Members/core2.jpg", quote: "A picture is worth a thousand words.", instagram: "@core2", instaLink: "https://www.instagram.com/core2" },
    { name: "Core Member 3", photo: "/Members/core3.jpg", quote: "Finding beauty in the ordinary.", instagram: "@core3", instaLink: "https://www.instagram.com/core3" },
    { name: "Core Member 4", photo: "/Members/core4.jpg", quote: "Moments captured, memories preserved.", instagram: "@core4", instaLink: "https://www.instagram.com/core4" },
    { name: "Core Member 5", photo: "/Members/core5.jpg", quote: "Chasing light, capturing life.", instagram: "@core5", instaLink: "https://www.instagram.com/core5" },
    { name: "Core Member 6", photo: "/Members/core6.jpg", quote: "Through the lens, we see the world differently.", instagram: "@core6", instaLink: "https://www.instagram.com/core6" },
  ];

  // POC Members Data (Unchanged)
  const pocMembers = [
    { name: "Dharanidharan",
      photo: "/Members/member1.jpg",
      quote: "Photography is the story I fail to put into words.",
      instagram: "@this_is_dharanidharan",
      instaLink: "https://www.instagram.com/this_is_dharanidharan"},
    { name: "POC Member 1", photo: "/Members/poc1.jpg", instagram: "@poc1", instaLink: "https://www.instagram.com/poc1" },
    { name: "POC Member 2", photo: "/Members/poc2.jpg", instagram: "@poc2", instaLink: "https://www.instagram.com/poc2" },
    { name: "POC Member 3", photo: "/Members/poc3.jpg", instagram: "@poc3", instaLink: "https://www.instagram.com/poc3" },
    { name: "POC Member 4", photo: "/Members/poc4.jpg", instagram: "@poc4", instaLink: "https://www.instagram.com/poc4" },
    { name: "POC Member 5", photo: "/Members/poc5.jpg", instagram: "@poc5", instaLink: "https://www.instagram.com/poc5" },
    { name: "POC Member 6", photo: "/Members/poc6.jpg", instagram: "@poc6", instaLink: "https://www.instagram.com/poc6" },
    { name: "POC Member 7", photo: "/Members/poc7.jpg", instagram: "@poc7", instaLink: "https://www.instagram.com/poc7" },
    { name: "POC Member 8", photo: "/Members/poc8.jpg", instagram: "@poc8", instaLink: "https://www.instagram.com/poc8" },
    { name: "POC Member 9", photo: "/Members/poc9.jpg", instagram: "@poc9", instaLink: "https://www.instagram.com/poc9" },
    { name: "POC Member 10", photo: "/Members/poc10.jpg", instagram: "@poc10", instaLink: "https://www.instagram.com/poc10" },
  ];

  // Reusable Member Grid Component (Modified insta-link)
  const MemberGrid = ({ title, members }) => (
    <section className="member-section"> {/* Changed class to section */}
      <h2 className="section-title">{title}</h2> {/* Changed class */}
      <div className="members-grid">
        {members.map((member, index) => ( // Added index for animation delay key
          <div className="member-card" key={member.name} style={{ animationDelay: `${0.1 * index}s` }}> {/* Add staggered delay */}
            <div className="member-photo-wrapper">
              <img
                src={member.photo}
                alt={`${member.name}`}
                className="member-photo"
                onError={(e) => e.target.src = '/images/avatar_placeholder.png'} // Placeholder
              />
            </div>
            <h3 className="member-name">{member.name}</h3>
            {member.quote && <p className="member-quote">"{member.quote}"</p>}
            <a
              href={member.instaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="insta-link"
              aria-label={`${member.name}'s Instagram profile`}
            >
              <FaInstagram className="insta-icon" /> {/* Added Icon */}
              <span>{member.instagram}</span> {/* Wrapped text in span */}
            </a>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    // Changed outer class name
    <div className="club-info-page">
      <div className="club-info-container"> {/* Optional inner container */}
        <h1 className="page-title">Meet Our Team</h1> {/* Changed title & class */}
        <p className="intro-text">
          Driven by passion and creativity, our members are the heartbeat of Capturesque. Get to know the faces behind the lens.
        </p>

        {/* Render Each Section */}
        {/* Use emojis or keep text, styled with CSS */}
        <MemberGrid title="Club Heads" members={clubHeads} />
        <MemberGrid title="Core Committee" members={coreCommittee} />
        <MemberGrid title="POC Members" members={pocMembers} />
      </div>
    </div>
  );
};

export default ClubInfo;