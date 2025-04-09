// src/context/CpuContext.jsx
import React, { createContext, useReducer, useContext } from 'react';
import { fetch, decode, execute } from '../logic/cpuCore';

// It's cleaner if cpuCore exports constants it uses internally
// Or redefine them here, ensuring they match
const MEMORY_SIZE = 512;
const ADDR_MASK = 0x1FF;

const initialCpuState = {
  registers: {
    pc: 0,      // Program Counter (9 bits address space)
    ar: 0,      // Address Register (9 bits) - Internal CPU state, may not be directly settable
    acc: 0,     // Accumulator (16 bits)
    dr: 0,      // Data Register (16 bits) - Used as source/destination (R2 in Reg ops)
    tr: 0,      // Temp Register (16 bits) - Internal ALU use, shown for debug
    pr: 0,      // Port Register? (Let's assume 9 bits for consistency if used) - Maybe unused
    // Ensure all registers displayed are initialized
  },
  flags: {
    Z: 0, // Zero flag
    C: 0, // Carry flag
    N: 0, // Negative/Sign flag
    V: 0, // Overflow flag
    // I: 0, // Interrupt Enable (if applicable)
  },
  memory: new Array(MEMORY_SIZE).fill(0), // Use constant for size
  isRunning: false,
  outputLog: ["CPU Initialized and Ready."], // Initial log message
};

// --- Rest of CpuContext.jsx ---
// The reducer logic seems mostly okay, but ensure the error handling in STEP
// and the state update structure are robust.

function cpuReducer(state, action) {
  // console.log("Reducer Action:", action.type, action.payload); // Verbose logging
  switch (action.type) {
    case 'RESET':
      // Preserve memory on reset unless specifically cleared by LOAD_CODE
      return {
        ...initialCpuState, // Reset registers, flags, isRunning
        memory: state.memory, // Keep current memory
        outputLog: [...state.outputLog, `CPU Reset (Memory Preserved).`] // Append log
      };

    case 'START_RUN':
       // Check if already halted? Maybe allow restart from current PC?
      if (state.isRunning) return state;
      return { ...state, isRunning: true, outputLog: [...state.outputLog, 'Run Started...'] };

    case 'STOP_RUN':
      if (!state.isRunning) return state;
      return { ...state, isRunning: false, outputLog: [...state.outputLog, 'Run Stopped by User.'] };

    case 'STEP': {
      if (state.isRunning) {
         console.warn("Manual step ignored while auto-running.");
         return state;
      }
      const pcBeforeExecution = state.registers.pc;

      try {
        // --- Pre-execution Checks ---
        if (typeof pcBeforeExecution !== 'number' || isNaN(pcBeforeExecution) || pcBeforeExecution < 0 || pcBeforeExecution >= MEMORY_SIZE) {
             throw new Error(`Invalid PC state before fetch: ${pcBeforeExecution}`);
        }

        // Fetch instruction
        const instructionWord = fetch(state.memory, pcBeforeExecution);

        // Decode instruction
        const decoded = decode(instructionWord);
         // Log decode result? console.log("Decoded:", decoded);

        // Check for HALT state *before* execute if HALT is just a state, not an instruction
        // (Not applicable here, HALT is an instruction)

        // Execute instruction
        const updates = execute(decoded, state); // Pass current full state

        // --- Post-execution Update ---
        const nextLog = `[${pcBeforeExecution.toString(16).padStart(3,'0')}] ${updates.log}`;

        return {
          ...state, // Keep other top-level state like outputLog base
          registers: updates.registers, // Takes entire new registers object from execute
          flags: updates.flags,
          memory: updates.memory, // Takes potentially updated memory array
          isRunning: state.isRunning && !updates.halt, // Stop running ONLY if execute returned halt=true
          outputLog: [...state.outputLog, nextLog], // Append new log message
        };

      } catch (error) {
        console.error("CPU Step Error:", error);
        const errorLocation = (typeof state?.registers?.pc === 'number' && !isNaN(state.registers.pc))
                               ? state.registers.pc.toString(16).padStart(3,'0')
                               : 'unknown PC';

        // Halt execution on any error during step
        return {
          ...state,
          // Keep registers/flags/memory as they were *before* the failed step for inspection?
          // Or use the potentially partially modified state from 'updates' if available?
          // Let's keep the state just before the error for easier debugging.
          registers: state.registers,
          flags: state.flags,
          memory: state.memory,
          isRunning: false, // Stop running
          outputLog: [...state.outputLog, `ERROR @ ${errorLocation}: ${error.message}`],
        };
      }
    } // End STEP case

    case 'LOAD_CODE': {
      const newMemory = new Array(MEMORY_SIZE).fill(0);
      let loadedWords = 0;
      if (action.payload && Array.isArray(action.payload)) {
         loadedWords = action.payload.length;
         for(let i = 0; i < loadedWords && i < newMemory.length; i++) {
           // Ensure only valid numbers are loaded
           const word = Number(action.payload[i]);
           newMemory[i] = isNaN(word) ? 0 : (word & MAX_WORD_VALUE);
         }
       }
       // Reset everything when loading new code
       return {
         ...initialCpuState, // Full reset of registers, flags, isRunning
         memory: newMemory, // Use the newly loaded memory
         outputLog: [`Code loaded (${loadedWords} words). CPU Reset.`] // Fresh log
       };
     } // End LOAD_CODE

    case 'UPDATE_LOG': // For general messages from UI components
       return { ...state, outputLog: [...state.outputLog, action.payload] };

    default:
      console.warn(`Unhandled action type: ${action.type}`);
      return state;
  }
}

// Context, Provider, Hook remain the same
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