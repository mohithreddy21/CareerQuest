document.addEventListener('DOMContentLoaded', function() {
    const tailorResumeBtn = document.getElementById('tailorResumeBtn');
    const resumeChatbot = document.getElementById('resumeChatbot');
    const minimizeBtn = document.getElementById('minimizeBtn');
    const maximizeBtn = document.getElementById('maximizeBtn');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.querySelector('.chat-input');

    let isMaximized = false;
    const originalStyles = {};

    if (tailorResumeBtn && resumeChatbot && minimizeBtn && maximizeBtn && chatMessages && chatInput) {
        tailorResumeBtn.addEventListener('click', function() {
            resumeChatbot.style.display = 'flex';
            setTimeout(() => { // Add a slight delay to allow the display style to apply
                resumeChatbot.classList.add('active');
            }, 50);
        });

        minimizeBtn.addEventListener('click', function() {
            if (isMaximized) {
                resumeChatbot.classList.remove('maximized');
                resumeChatbot.style.top = originalStyles.top || '';
                resumeChatbot.style.right = originalStyles.right || '20px';
                resumeChatbot.style.bottom = originalStyles.bottom || '20px';
                resumeChatbot.style.width = originalStyles.width || '350px';
                resumeChatbot.style.maxHeight = originalStyles.maxHeight || '450px';
                resumeChatbot.style.height = 'auto';
                minimizeBtn.textContent = '-';
                isMaximized = false;
            } else {
                chatMessages.style.display = 'none';
                chatInput.style.display = 'none';
                maximizeBtn.style.display = 'inline-block';
                minimizeBtn.style.display = 'none';
                resumeChatbot.style.maxHeight = 'auto';
                resumeChatbot.style.height = 'auto';
            }
        });

        maximizeBtn.addEventListener('click', function() {
            if (!isMaximized) {
                originalStyles.top = resumeChatbot.style.top;
                originalStyles.right = resumeChatbot.style.right;
                originalStyles.bottom = resumeChatbot.style.bottom;
                originalStyles.width = resumeChatbot.style.width;
                originalStyles.maxHeight = resumeChatbot.style.maxHeight;

                resumeChatbot.classList.add('maximized');
                resumeChatbot.style.top = '0';
                resumeChatbot.style.right = '0';
                resumeChatbot.style.bottom = '0';
                resumeChatbot.style.width = '400px';
                resumeChatbot.style.maxHeight = '100vh';
                minimizeBtn.style.display = 'inline-block';
                maximizeBtn.style.display = 'none';
                isMaximized = true;
            }
        });

        // Initially hide the maximize button
        maximizeBtn.style.display = 'none';
    }
});