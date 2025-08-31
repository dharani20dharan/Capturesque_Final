// src/components/Toast.js

/**
 * This component displays a simple toast notification at the bottom of the screen.
 * It is used to show feedback messages to the user, such as "File downloaded" or "Link copied."
 * The message is passed as a prop, and the component is only rendered if a message exists.
 */
import React from 'react';

export const Toast = ({ message }) => (message ? <div className="toast">{message}</div> : null);