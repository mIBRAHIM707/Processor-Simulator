// src/context/CpuContext.jsx
import React, { createContext, useReducer, useContext } from 'react';
import { fetch, decode, execute } from '../logic/cpuCore';

const initialCpuState = {
  registers: { /* ... */ },
  flags: { /* ... */ },
  memory: new Array(512).fill(0),
  isRunning: false, // <<<<< Initial state is important
  outputLog: [],
};

function cpuReducer(state, action) {
  console.log("Reducer Action:", action);
  switch (action.type) {
    case 'RESET':
      return {
        ...initialCpuState, // Reset completely
        memory: state.memory, // Keep memory unless LOAD_CODE happens
        outputLog: [`CPU Reset.`]
      };

    // --- ADDED START_RUN and STOP_RUN ---
    case 'START_RUN':
      if (state.isRunning) return state; // Avoid starting if already running
      return { ...state, isRunning: true };

    case 'STOP_RUN':
      if (!state.isRunning) return state; // Avoid stopping if not running
      return { ...state, isRunning: false };
    // ------------------------------------

    case 'STEP': {
      // Safeguard: Don't allow manual step if autorun is active
      if (state.isRunning) {
         console.warn("Manual step attempted while running.");
         return state;
      }
      // Store the PC *before* execution for logging, handle potential undefined defensively
      const pcBeforeExecution = state.registers?.pc ?? 'unknown';

      try {
        const currentPC = state.registers.pc; // Read the potentially problematic PC

        // --- Add a check right here ---
        if (typeof currentPC !== 'number' || currentPC < 0 || currentPC >= MEMORY_SIZE) {
             throw new Error(`Invalid PC before fetch: ${currentPC}`);
        }
        // -------------------------------

        // Check for HALT condition (e.g., specific instruction or PC out of bounds)
        // Add HALT logic here if needed before fetch/decode/execute

        const instructionWord = fetch(state.memory, currentPC);
        const decoded = decode(instructionWord);
        const updates = execute(decoded, state); // execute returns { registers, flags, memory, pc, log }

        // Basic HALT check (Example: Specific opcode like 0xF000? Adjust as needed)
        const isHalt = (decoded.originalWord & 0xF000) === 0xF000; // Replace with your actual HALT condition

        // --- *** CORRECTED RETURN STRUCTURE *** ---
        return {
          ...state, // Keep non-CPU parts like isRunning
          registers: {
              ...updates.registers, // Get ACC, DR etc from execute's return
              pc: updates.pc         // <<< USE THE NEW PC FROM execute's return!
          },
          flags: updates.flags,
          memory: updates.memory,
          // Stop running if a HALT instruction was executed
          isRunning: isHalt ? false : state.isRunning,
          outputLog: [
            ...state.outputLog,
             // Use the PC value captured *before* this step for the log message
            `[${pcBeforeExecution.toString(16).padStart(3,'0')}] ${updates.log}`,
            ...(isHalt ? ['--- HALT ---'] : []) // Add HALT message if applicable
          ],
        };
        // --- *** END CORRECTION *** ---

      } catch (error) {
        console.error("CPU Step Error:", error);
        // --- Safer Catch Block ---
        const errorLocation = typeof state?.registers?.pc === 'number'
                               ? state.registers.pc.toString(16).padStart(3,'0')
                               : pcBeforeExecution; // Use the value from before the try block if current is bad

        return {
          ...state,
          registers: { // Ensure registers object exists even on error
            ...state.registers, // Keep previous register values if possible
            pc: state.registers?.pc ?? 0 // Try to keep PC, default to 0 if undefined
          },
          isRunning: false, // Stop running on error
          outputLog: [...state.outputLog, `ERROR @ ${errorLocation}: ${error.message}`],
        };
        // --- End Safer Catch Block ---
      }
    } // End STEP case block scope

    case 'LOAD_CODE': {
      const newMemory = new Array(512).fill(0);
      let loadedWords = 0;
      if (action.payload && Array.isArray(action.payload)) {
         loadedWords = action.payload.length;
         for(let i = 0; i < loadedWords && i < newMemory.length; i++) {
           newMemory[i] = Number(action.payload[i]) || 0;
         }
       }
       // Reset everything INCLUDING isRunning when loading new code
       return {
         ...initialCpuState,
         memory: newMemory,
         outputLog: [`Code loaded (${loadedWords} words). CPU Reset.`]
       };
     } // End LOAD_CODE block scope

    case 'UPDATE_LOG':
       return { ...state, outputLog: [...state.outputLog, action.payload] };

    default:
      console.error(`Unhandled action type: ${action.type}`);
      return state;
  }
}

// --- Context, Provider, Hook (no changes needed here) ---
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