export const playSound = (soundFile) => {
    const audio = new Audio(soundFile);
    audio.play().catch(error => {
        console.error("Error playing sound:", error);
        audio.dispatchEvent(new Event('error')); // Dispatch error so listeners know it failed
    });
    return audio;
};