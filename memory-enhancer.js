/**
 * Memory Display Enhancer for the Simulator
 * Improves memory visualization with sections and improved markers
 */

// Store original function so we can call it
let originalMemoryUI;

// Wait for DOM before setting up overrides
document.addEventListener('DOMContentLoaded', function() {
    // Safety check - only proceed if the function exists
    if (typeof updateMemoryUI === 'function') {
        originalMemoryUI = updateMemoryUI;
        
        // Now override the function
        updateMemoryUI = function() {
            // Get current memory contents as plain text (original approach)
            let memHTML = '';
            
            // Divide memory into sections (16 rows per section)
            const SECTION_SIZE = 64; // 64 words per section
            const TOTAL_MEMORY = memory.length;
            const sections = Math.ceil(TOTAL_MEMORY / SECTION_SIZE);
            
            for (let section = 0; section < sections; section++) {
                const startAddr = section * SECTION_SIZE;
                const endAddr = Math.min((section + 1) * SECTION_SIZE - 1, TOTAL_MEMORY - 1);
                
                // Section header
                memHTML += `<div class="memory-section">`;
                memHTML += `<div class="memory-section-header">
                              <span>Memory ${formatHex(startAddr, 10)} - ${formatHex(endAddr, 10)}</span>
                              <span>Section ${section + 1}/${sections}</span>
                            </div>`;
                
                // Memory content for this section
                for (let i = startAddr; i <= endAddr; i++) {
                    const value = memory[i];
                    const isPc = (i === lastPC);
                    const isAr = (i === AR);
                    const lineClass = isPc ? "memory-line pc-line" : 
                                    isAr ? "memory-line ar-line" : 
                                    "memory-line";
                    
                    memHTML += `<div class="${lineClass}">`;
                    memHTML += `${formatHex(i, 10)}: ${formatHex(value, 16)}`;
                    
                    // Add markers for PC and AR with better visual indicators
                    if (isPc) {
                        memHTML += `<span class="memory-marker pc-marker" title="Program Counter">P</span>`;
                    }
                    if (isAr) {
                        memHTML += `<span class="memory-marker ar-marker" title="Address Register">A</span>`;
                    }
                    
                    memHTML += `</div>`;
                }
                
                memHTML += `</div>`;
            }
            
            if (memoryView) {
                memoryView.innerHTML = memHTML;
                
                // Scroll to active PC or AR location if it exists
                const activeLine = document.querySelector('.pc-line') || document.querySelector('.ar-line');
                if (activeLine) {
                    activeLine.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }
            }
        };
    }
});

// Add hover effect to memory lines
document.addEventListener('DOMContentLoaded', function() {
    document.addEventListener('mouseover', function(e) {
        if (e.target.classList.contains('memory-line')) {
            const address = e.target.textContent.split(':')[0].trim();
            // Could add tooltip or highlight related information
        }
    });
});

// Initialize
console.log('Memory display enhancements loaded!');
