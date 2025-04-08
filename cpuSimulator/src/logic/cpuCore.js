// src/logic/cpuCore.js

// --- Constants based on ISA ---
const MEMORY_SIZE = 512;
const WORD_SIZE = 16; // Bits
const ADDR_MASK = 0x1FF; // 9 bits for address (2^9 = 512)
const MAX_WORD_VALUE = 0xFFFF; // Max value for a 16-bit word

// Predicate codes mapping (adjust if your ISA definition changed)
const PREDICATE = {
    AL: 0b000, EQ: 0b001, NE: 0b010, CS: 0b011,
    CC: 0b100, MI: 0b101, PL: 0b110, VS: 0b111,
};

// Opcode mapping (adjust based on your ISA) - Example for Memory Ref
const OPCODE_MEM = {
    LDA: 0b0000, STA: 0b0001, ADD: 0b0010, SUB: 0b0011,
    AND: 0b0100, OR:  0b0101, XOR: 0b0110, JMP: 0b0111,
    // Add Register Ref and I/O opcodes here if they share the same bits
};
// Separate maps might be needed if opcodes overlap for different instruction types

// --- Helper Functions ---

// Sign extend a 9-bit address if needed (usually not for direct addresses)
// function signExtend9bit(value) { ... }

// Update Flags based on ALU result (basic example)
function calculateFlags(result, carry = 0, overflow = 0, isNegative = 0) {
  const Z = (result & MAX_WORD_VALUE) === 0 ? 1 : 0;
  // Assume N is bit 15 of the result for signed operations
  const N = isNegative !== 0 ? isNegative : ((result >> (WORD_SIZE - 1)) & 1);
  // Carry (C) and Overflow (V) often need specific logic per operation
  const C = carry;
  const V = overflow;
  return { Z, C, N, V };
}

// --- Core Cycle Functions ---

export function fetch(memory, pc) {
  if (pc >= 0 && pc < MEMORY_SIZE) {
    return memory[pc];
  }
  throw new Error(`PC out of bounds: ${pc}`);
}

export function decode(instructionWord) {
  // Extract parts based on ISA format (Memory Reference example)
  const opcode = (instructionWord >> 12) & 0xF;     // Bits 15-12
  const predicate = (instructionWord >> 9) & 0x7;    // Bits 11-9
  const address = instructionWord & ADDR_MASK;       // Bits 8-0

  // TODO: Add logic to differentiate between Memory, Register, I/O formats
  // This might involve checking specific opcode ranges or patterns.
  // For now, assume Memory Reference format for simplicity.
  return {
    type: 'MEMORY', // Or 'REGISTER', 'IO'
    opcode,
    predicate,
    address,
    originalWord: instructionWord // Keep original for logging
  };
}

/**
 * Executes a decoded instruction.
 * IMPORTANT: This function should return the *changes* to the state,
 * not modify the state directly.
 * @param {object} decoded - Decoded instruction ({ type, opcode, predicate, address, ... })
 * @param {object} currentState - The *entire* current CPU state from the reducer
 * @returns {object} An object containing the *updated* state fields (registers, flags, memory, pc).
 */
export function execute(decoded, currentState) {
  const { registers, flags, memory } = currentState;
  const { predicate, opcode, address } = decoded;

  // --- 1. Check Predicate ---
  let shouldExecute = false;
  switch (predicate) {
    case PREDICATE.AL: shouldExecute = true; break;
    case PREDICATE.EQ: shouldExecute = (flags.Z === 1); break;
    case PREDICATE.NE: shouldExecute = (flags.Z === 0); break;
    case PREDICATE.CS: shouldExecute = (flags.C === 1); break;
    case PREDICATE.CC: shouldExecute = (flags.C === 0); break;
    case PREDICATE.MI: shouldExecute = (flags.N === 1); break;
    case PREDICATE.PL: shouldExecute = (flags.N === 0); break;
    case PREDICATE.VS: shouldExecute = (flags.V === 1); break;
    default: throw new Error(`Unknown predicate code: ${predicate}`);
  }

  // Prepare structure for state updates
  let nextRegisters = { ...registers };
  let nextFlags = { ...flags };
  let nextMemory = [...memory]; // Copy memory for potential writes
  let nextPC = (registers.pc + 1) & ADDR_MASK; // Default: Increment PC
  let logMessage = `Exec: ${decoded.originalWord.toString(16).padStart(4,'0')} - `;

  if (!shouldExecute) {
    logMessage += `Skipped (Predicate ${predicate} failed)`;
    return { registers: nextRegisters, flags: nextFlags, memory: nextMemory, pc: nextPC, log: logMessage };
  }

  // --- 2. Execute based on Opcode (Memory Reference Example) ---
  // Use intermediate variables for clarity
  let memValue = 0;
  let result = 0;
  let carry = 0;
  let overflow = 0; // Basic overflow detection needed for ADD/SUB

  logMessage += `Op:${opcode} Pred:${predicate} Addr:${address.toString(16)} - `;

  switch (decoded.opcode) {
     case OPCODE_MEM.LDA: // Load Accumulator from Memory
         memValue = memory[address];
         nextRegisters.acc = memValue;
         logMessage += `LDA M[${address.toString(16)}] -> ACC = ${memValue.toString(16)}`;
         // Flags usually aren't affected by LDA, but some ISAs might set Z/N
         // nextFlags = calculateFlags(nextRegisters.acc); // Example if flags change
         break;

     case OPCODE_MEM.STA: // Store Accumulator to Memory
         nextMemory[address] = registers.acc;
         logMessage += `STA ACC (${registers.acc.toString(16)}) -> M[${address.toString(16)}]`;
         break;

     case OPCODE_MEM.ADD: // Add Memory to Accumulator
         memValue = memory[address];
         result = registers.acc + memValue;
         // Basic Carry/Overflow detection (improve for signed/unsigned as needed)
         carry = (result > MAX_WORD_VALUE) ? 1 : 0;
         // Simple overflow check for signed (assumes 2's complement)
         overflow = (((registers.acc ^ memValue) & 0x8000) === 0 && ((registers.acc ^ result) & 0x8000) !== 0) ? 1 : 0;
         nextRegisters.acc = result & MAX_WORD_VALUE;
         nextFlags = calculateFlags(nextRegisters.acc, carry, overflow);
         logMessage += `ADD M[${address.toString(16)}] (${memValue.toString(16)}) + ACC (${registers.acc.toString(16)}) -> ACC = ${nextRegisters.acc.toString(16)}`;
         break;

     case OPCODE_MEM.SUB: // Subtract Memory from Accumulator
         memValue = memory[address];
         // Implement subtraction using 2's complement addition: ACC + (-memValue)
         const negMemValue = (~memValue + 1) & MAX_WORD_VALUE;
         result = registers.acc + negMemValue;
         carry = (result > MAX_WORD_VALUE) ? 1 : 0; // Carry often inverted for SUB borrow
         overflow = (((registers.acc ^ memValue) & 0x8000) !== 0 && ((registers.acc ^ result) & 0x8000) !== 0) ? 1 : 0; // Overflow check
         nextRegisters.acc = result & MAX_WORD_VALUE;
         nextFlags = calculateFlags(nextRegisters.acc, carry, overflow); // Adjust carry logic for SUB if needed (often C=1 means NO borrow)
         logMessage += `SUB M[${address.toString(16)}] (${memValue.toString(16)}) from ACC (${registers.acc.toString(16)}) -> ACC = ${nextRegisters.acc.toString(16)}`;
         break;

     case OPCODE_MEM.JMP: // Unconditional Jump (Predicate AL=000 assumed handled)
          // Your ISA doc shows JMP M[AR] for PC <- M[AR]
          // But the format has Address/Offset. Assuming it means PC <- Address
          // **Clarify JMP behaviour from your ISA document**
          // Assuming PC <- Address field for now:
          nextPC = address;
          logMessage += `JMP to ${address.toString(16)}`;
          break;

      // TODO: Add cases for AND, OR, XOR
      // TODO: Add cases for Register Reference instructions
      // TODO: Add cases for I/O instructions

     default:
         logMessage += `ERROR: Unknown Opcode ${decoded.opcode}`;
         // Decide how to handle unknown opcodes (halt? throw error?)
         // throw new Error(`Unknown opcode: ${decoded.opcode}`);
         console.error(logMessage);
  }


  return { registers: nextRegisters, flags: nextFlags, memory: nextMemory, pc: nextPC, log: logMessage };
}