// src/context/CpuContext.jsx
import React, { createContext, useReducer, useContext } from 'react';
import { fetch, decode, execute } from '../logic/cpuCore'; // Import core logic functions
// --- Define Initial CPU State ---
const initialCpuState = {
  registers: {
    acc: 0,
    pc: 0,
    ar: 0,
    dr: 0,
    tr: 0,
    pr: 0, // 8-bit Predicate Register
  },
  flags: {
    Z: 0, // Zero Flag
    C: 0, // Carry Flag
    N: 0, // Negative/Sign Flag
    V: 0, // Overflow Flag
    // Add other flags if needed (e.g., Interrupt Enable)
  },
  memory: new Array(512).fill(0), // 512 words of 16-bit memory, initialized to 0
  isRunning: false, // Is the CPU currently in a continuous run?
  outputLog: [], // Array to store messages/logs
  // Add any other global state needed (e.g., current instruction string)
};

// --- Define the Reducer Function ---
// This function handles state updates based on dispatched actions
function cpuReducer(state, action) {
  console.log("Reducer Action:", action);
  switch (action.type) {
    case 'RESET':
      // ... (same as before) ...
      return {
        ...initialCpuState,
        outputLog: ['CPU Reset.'],
      };

    case 'STEP': { // Use block scope for variables
      if (state.isRunning) return state; // Don't step if auto-running (add later)
      try {
        const currentPC = state.registers.pc;
        const instructionWord = fetch(state.memory, currentPC);
        const decoded = decode(instructionWord);

        // Execute returns the *changes* or the *complete next state slices*
        const updates = execute(decoded, state);

        // Merge the updates into the new state
        return {
          ...state, // Keep other state parts like isRunning
          registers: updates.registers,
          flags: updates.flags,
          memory: updates.memory, // Assume execute returned the full new memory array
          // Update PC based on execute result (JMP might change it)
          registers: { ...updates.registers, pc: updates.pc },
          outputLog: [...state.outputLog, `[${currentPC.toString(16).padStart(3,'0')}] ${updates.log}`], // Add log message from execute
        };
      } catch (error) {
        console.error("CPU Step Error:", error);
        // Halt CPU or indicate error state?
        return {
          ...state,
          isRunning: false, // Stop if running
          outputLog: [...state.outputLog, `ERROR: ${error.message}`],
        };
      }
    } // End STEP case block scope

    case 'LOAD_CODE': { // Use block scope
       // ... (existing code to copy payload to newMemory) ...
       const newMemory = new Array(512).fill(0);
       let loadedWords = 0;
       if (action.payload && Array.isArray(action.payload)) {
         loadedWords = action.payload.length;
         for(let i = 0; i < loadedWords && i < newMemory.length; i++) {
           // Ensure loaded values are valid numbers (e.g., handle NaN)
           newMemory[i] = Number(action.payload[i]) || 0;
         }
       }
       return {
         ...initialCpuState, // Reset everything else on load
         memory: newMemory,
         outputLog: [`Code loaded (${loadedWords} words). CPU Reset.`]
       };
     } // End LOAD_CODE block scope

    case 'UPDATE_LOG':
       // ... (same as before) ...
       return { ...state, outputLog: [...state.outputLog, action.payload] }

    default:
      console.error(`Unhandled action type: ${action.type}`);
      return state;
  }
}

// --- Create the Context ---
const CpuContext = createContext();

// --- Create the Provider Component ---
// This component will wrap our App and provide the state and dispatch function
export function CpuStateProvider({ children }) {
  const [state, dispatch] = useReducer(cpuReducer, initialCpuState);

  return (
    <CpuContext.Provider value={{ state, dispatch }}>
      {children}
    </CpuContext.Provider>
  );
}

// --- Create a Custom Hook for easy access ---
// Simplifies consuming the context in components
export function useCpuState() {
  const context = useContext(CpuContext);
  if (context === undefined) {
    throw new Error('useCpuState must be used within a CpuStateProvider');
  }
  return context;
}