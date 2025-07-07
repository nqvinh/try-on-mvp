// widget.js

// 1. Tránh tạo trùng
if (document.getElementById('fashly-widget-container')) {
    console.log('Fashly widget already initialized');
    return;
  }
  
  // 2. Tạo container chính
  const container = document.createElement('div');
  container.id = 'fashly-widget-container';
  Object.assign(container.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '300px',
    height: '100%',
    zIndex: '9999',
    backgroundColor: '#fff',
    boxShadow: '2px 0 8px rgba(0,0,0,0.2)',
  });
  
  // 3. Tạo iframe
  const iframe = document.createElement('iframe');
  iframe.src = 'https://yourdomain.com/popup-content';
  Object.assign(iframe.style, {
    width: '100%',
    height: '100%',
    border: 'none',
  });
  container.appendChild(iframe);
  
  // 4. Tạo nút đóng
  const closeBtn = document.createElement('button');
  closeBtn.innerText = '✕';
  Object.assign(closeBtn.style, {
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: 'transparent',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer',
  });
  closeBtn.addEventListener('click', () => {
    container.remove();
  });
  container.appendChild(closeBtn);
  
  // 5. Chèn vào DOM
  document.body.appendChild(container);
  