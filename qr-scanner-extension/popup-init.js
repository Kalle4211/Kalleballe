// Fallback to CDN if local socket.io.js fails
if (typeof io === 'undefined') {
  const script = document.createElement('script');
  script.src = 'https://cdn.socket.io/4.8.1/socket.io.min.js';
  document.head.appendChild(script);
} 