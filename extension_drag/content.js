// Function to decode QR code from image
async function decodeQRCode(imageElement) {
    try {
        // Create a canvas element
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        // Set canvas dimensions to match image
        canvas.width = imageElement.naturalWidth;
        canvas.height = imageElement.naturalHeight;
        
        // Draw image on canvas
        context.drawImage(imageElement, 0, 0);
        
        // Get image data
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        
        // Use jsQR library to decode
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
            return code.data;
        }
        return null;
    } catch (error) {
        console.error('Error decoding QR code:', error);
        return null;
    }
}

// Function to copy text to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showNotification('Content copied to clipboard!', 'success');
    } catch (error) {
        console.error('Error copying to clipboard:', error);
        showNotification('Failed to copy content', 'error');
    }
}

// Function to show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 5px;
        color: white;
        font-family: Arial, sans-serif;
        z-index: 10000;
        animation: fadeIn 0.3s, fadeOut 0.3s 2.7s;
        background-color: ${type === 'success' ? '#4CAF50' : '#f44336'};
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Function to add click handler to QR code images
function addQRCodeHandlers() {
    // Find all images that might be QR codes
    const images = document.querySelectorAll('img');
    
    images.forEach(img => {
        // Skip if already processed
        if (img.dataset.qrProcessed) return;
        
        // Add click handler
        img.addEventListener('click', async (e) => {
            // Check if image is likely a QR code (square aspect ratio)
            const ratio = img.naturalWidth / img.naturalHeight;
            if (ratio > 0.9 && ratio < 1.1) {
                const content = await decodeQRCode(img);
                if (content) {
                    await copyToClipboard(content);
                } else {
                    showNotification('No QR code content found', 'error');
                }
            }
        });
        
        // Mark as processed
        img.dataset.qrProcessed = 'true';
    });
}

// Load jsQR library
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
script.onload = () => {
    // Initial scan for QR codes
    addQRCodeHandlers();
    
    // Watch for new images being added to the page
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                addQRCodeHandlers();
            }
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
};
document.head.appendChild(script); 