// src/context/CpuContext.jsx
import React, { createContext, useReducer, useContext } from 'react';

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
  console.log("Reducer Action:", action); // Good for debugging
  switch (action.type) {
    case 'RESET':
      // Reset everything except maybe the log? Or clear log too?
      return {
         ...initialCpuState,
         // Keep logs if desired: outputLog: state.outputLog
         outputLog: ['CPU Reset.'], // Start with a reset message
      };

    case 'STEP':
      // TODO: Implement the logic for a single instruction cycle
      // 1. Fetch instruction at PC
      // 2. Decode instruction
      // 3. Execute instruction (updating registers, flags, memory, pc)
      // 4. Update log
      console.warn("STEP action not yet implemented!");
      // For now, just add a log message
      return {
        ...state,
        outputLog: [...state.outputLog, `STEP not implemented (PC: ${state.registers.pc})`]
      };

    case 'LOAD_CODE':
      // TODO: Implement loading machine code into memory
       console.warn("LOAD_CODE action not yet implemented!");
      // action.payload should be an array of machine code words
      // We need to copy them into state.memory
       const newMemory = new Array(512).fill(0); // Start fresh
       if (action.payload && Array.isArray(action.payload)) {
         for(let i = 0; i < action.payload.length && i < newMemory.length; i++) {
           newMemory[i] = action.payload[i];
         }
       }
       return {
         ...initialCpuState, // Reset state before loading
         memory: newMemory,
         outputLog: [`Code loaded into memory (${action.payload?.length || 0} words). CPU Reset.`]
       };

    case 'UPDATE_LOG':
       return {
         ...state,
         outputLog: [...state.outputLog, action.payload] // Add a message string
       }

    // Add more actions later: RUN, STOP, SET_REGISTER, etc.

    default:
      console.error(`Unhandled action type: ${action.type}`);
      return state; // Return current state if action is unknown
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