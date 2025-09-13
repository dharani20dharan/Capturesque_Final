import React from 'react';

const Toast = ({ message }) => (message ? <div className="toast">{message}</div> : null);

export default Toast;