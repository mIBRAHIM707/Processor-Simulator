// src/context/CpuContext.jsx
import React, { createContext, useReducer, useContext } from 'react';
// Make sure constants are available here, either via import or definition
import { fetch, decode, execute, MAX_WORD_VALUE, MEMORY_SIZE, ADDR_MASK } from '../logic/cpuCore';

// Initial state using the constants
const initialCpuState = {
  registers: {
    pc: 0,      // Program Counter (9 bits address space)
    ar: 0,      // Address Register (9 bits) - Internal CPU state, may not be directly settable
    acc: 0,     // Accumulator (16 bits)
    dr: 0,      // Data Register (16 bits) - Used as source/destination (R2 in Reg ops)
    tr: 0,      // Temp Register (16 bits) - Internal ALU use, shown for debug
    pr: 0,      // Predicate Register (8 bits) - Currently unused by logic
  },
  flags: {
    Z: 0, // Zero flag
    C: 0, // Carry flag
    N: 0, // Negative/Sign flag
    V: 0, // Overflow flag
  },
  memory: new Array(MEMORY_SIZE).fill(0), // Use constant for size
  isRunning: false,
  outputLog: ["CPU Initialized and Ready."], // Initial log message
};


// Reducer function
function cpuReducer(state, action) {
  // console.log("Reducer Action:", action.type, action.payload); // Verbose logging for debug
  switch (action.type) {
    case 'RESET':
      // Preserve memory on reset unless specifically cleared by LOAD_CODE
      return {
        ...initialCpuState, // Reset registers, flags, isRunning
        memory: state.memory, // Keep current memory
        outputLog: [...state.outputLog, `CPU Reset (Memory Preserved). PC set to 0.`] // Append log
      };

    case 'START_RUN':
      if (state.isRunning) return state; // Prevent multiple concurrent runs
      // Check if PC is valid before starting? Optional.
      return { ...state, isRunning: true, outputLog: [...state.outputLog, 'Run Started...'] };

    case 'STOP_RUN':
      if (!state.isRunning) return state;
      return { ...state, isRunning: false, outputLog: [...state.outputLog, 'Run Stopped by User.'] };

    case 'STEP': {
      if (state.isRunning) {
         console.warn("Manual step ignored while auto-running.");
         return state;
      }
      // Check if PC is already pointing at a HALT instruction state?
      // This depends on whether HALT stops *before* or *after* execution.
      // Assuming execute handles HALT state.

      const pcBeforeExecution = state.registers.pc;

      try {
        // --- Pre-execution Checks ---
        if (typeof pcBeforeExecution !== 'number' || isNaN(pcBeforeExecution) || pcBeforeExecution < 0 || pcBeforeExecution >= MEMORY_SIZE) {
             // Halt execution if PC is invalid before fetch
             return {
               ...state,
               isRunning: false,
               outputLog: [...state.outputLog, `HALT - Invalid PC state before fetch: ${pcBeforeExecution}`],
             };
        }

        // Fetch instruction
        const instructionWord = fetch(state.memory, pcBeforeExecution);

        // Decode instruction
        const decoded = decode(instructionWord);

        // Execute instruction
        const updates = execute(decoded, state); // Pass current full state

        // --- Post-execution Update ---
        const nextLog = `[${pcBeforeExecution.toString(16).padStart(3,'0').toUpperCase()}] ${updates.log}`;

        // Halt if execute signals it OR if PC didn't advance and wasn't a JMP/HALT (potential infinite loop)
        // Simple halt check is sufficient for now based on execute output
        const shouldHalt = updates.halt;

        return {
          ...state, // Keep other top-level state like outputLog base
          registers: updates.registers, // Takes entire new registers object from execute
          flags: updates.flags,
          memory: updates.memory, // Takes potentially updated memory array
          isRunning: state.isRunning && !shouldHalt, // Stop running ONLY if execute returned halt=true
          outputLog: [...state.outputLog, nextLog], // Append new log message
        };

      } catch (error) {
        console.error("CPU Step Error:", error);
        const errorLocation = (typeof state?.registers?.pc === 'number' && !isNaN(state.registers.pc))
                               ? state.registers.pc.toString(16).padStart(3,'0').toUpperCase()
                               : 'unknown PC';

        // Halt execution on any error during step
        return {
          ...state,
          registers: state.registers, // Keep state before the error for debugging
          flags: state.flags,
          memory: state.memory,
          isRunning: false, // Stop running
          outputLog: [...state.outputLog, `ERROR @ ${errorLocation}: ${error.message}`],
        };
      }
    } // End STEP case

    case 'LOAD_CODE': {
        // STEP 1 CHANGE: Expect payload to be a Map
        const memoryMap = action.payload;
        if (!(memoryMap instanceof Map)) {
            console.error("LOAD_CODE Error: Payload is not a Map.", memoryMap);
            // Avoid modifying state if payload is invalid
            return { ...state, outputLog: [...state.outputLog, "Load Error: Invalid data received from assembler."]};
        }

        // Initialize new memory array
        const newMemory = new Array(MEMORY_SIZE).fill(0);
        let loadedWords = 0;
        let maxAddress = -1;

        // STEP 1 CHANGE: Iterate over the Map from the assembler
        for (const [address, value] of memoryMap.entries()) {
            // Validate address
            if (typeof address !== 'number' || isNaN(address) || address < 0 || address >= MEMORY_SIZE) {
                console.warn(`LOAD_CODE Warning: Invalid address ${address} skipped during memory population.`);
                continue; // Skip this entry
            }
            // Validate value
             if (typeof value !== 'number' || isNaN(value) || value < 0 || value > MAX_WORD_VALUE) {
                console.warn(`LOAD_CODE Warning: Invalid value ${value} at address ${address}. Storing 0.`);
                 newMemory[address] = 0; // Store 0 for invalid values
            } else {
                newMemory[address] = value & MAX_WORD_VALUE; // Ensure value fits 16 bits
            }
            loadedWords++;
            if(address > maxAddress) maxAddress = address; // Track highest address used
        }

        const maxAddrStr = maxAddress >= 0 ? `0x${maxAddress.toString(16).padStart(3,'0').toUpperCase()}` : 'N/A';

        // Reset everything when loading new code
        return {
            ...initialCpuState, // Full reset of registers, flags, isRunning
            memory: newMemory, // Use the newly constructed memory array
            // STEP 1 CHANGE: Update log message
            outputLog: [`Code loaded (${loadedWords} words mapped, max address ${maxAddrStr}). CPU Reset.`]
        };
     } // End LOAD_CODE

    // Add this case if you implement Option 1 controls for debugging
    case 'SET_MEMORY_LOCATION': {
        const { address, value } = action.payload;
        // Basic validation (more robust validation should be in the UI handler)
        if (typeof address !== 'number' || typeof value !== 'number'
            || address < 0 || address >= MEMORY_SIZE
            || value < 0 || value > MAX_WORD_VALUE) {
                console.error("Invalid address/value received in SET_MEMORY_LOCATION reducer:", action.payload);
                return { ...state, outputLog: [...state.outputLog, `Internal Error: Invalid memory set request.`]};
        }

        const newMemory = [...state.memory]; // Create a copy
        newMemory[address] = value & MAX_WORD_VALUE; // Ensure 16-bit

        const logMsg = `Set M[${address.toString(16).padStart(3, '0').toUpperCase()}] = ${value.toString(16).padStart(4, '0').toUpperCase()}`;

        return {
            ...state,
            memory: newMemory,
            outputLog: [...state.outputLog, logMsg]
        };
    }

    case 'UPDATE_LOG': // For general messages from UI components
       if(typeof action.payload !== 'string') return state; // Basic validation
       return { ...state, outputLog: [...state.outputLog, action.payload] };

    default:
      console.warn(`Unhandled action type: ${action.type}`);
      return state;
  }
}

// --- Context, Provider, Hook ---
const CpuContext = createContext();

export function CpuStateProvider({ children }) {
  const [state, dispatch] = useReducer(cpuReducer, initialCpuState);
  return (
    <CpuContext.Provider value={{ state, dispatch }}>
      {children}
    </CpuContext.Provider>
  );
}

export function useCpuState() {
  const context = useContext(CpuContext);
  if (context === undefined) {
    throw new Error('useCpuState must be used within a CpuStateProvider');
  }
  return context;
}