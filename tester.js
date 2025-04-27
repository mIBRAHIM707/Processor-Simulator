// --- Test Cases Definition ---
const testCases = [
    {
        name: "Test Case 1: Simple Arithmetic",
        assembly: `
            // Test Case 1: Simple Arithmetic
            ORG 100H
            LDA A         // AC = 10
            ADD B         // AC = 10 + 5 = 15
            STA C         // M[202h] = 15
            HLT

            ORG 200H
            A,  DEC 10
            B,  DEC 5
            C,  HEX 0
        `,
        expected: {
            AC: 15,
            PC: 0x104, // PC after HLT at 0x103
            memory: {
                "0x202": 15 // Corrected address check for C
            },
            halt: true
        }
    },
    {
        name: "Test Case 2a: Conditional Increment (AC=0)",
        assembly: `
            // Test Case 2a: Conditional Increment (AC=0)
            ORG 0
            LDA ZEROTEST  // AC = 0
            SETP P1, AC=0 // P1 = 1
            (P1) INC      // AC = 1
            STA RESULT
            HLT

            ZEROTEST, DEC 0
            RESULT,   HEX 0
        `,
        expected: {
            AC: 1,
            P1: 1,
            PC: 0x05,
            memory: {
                0x06: 1 // RESULT location
            },
            halt: true
        }
    },
    {
        name: "Test Case 2b: Conditional Increment (AC!=0)",
        assembly: `
            // Test Case 2b: Conditional Increment (AC!=0)
            ORG 0
            LDA NONZEROTEST // AC = 5
            SETP P1, AC=0   // P1 = 0
            (P1) INC        // Skipped
            STA RESULT
            HLT

            NONZEROTEST, DEC 5
            RESULT,     HEX 0
        `,
        expected: {
            AC: 5, // Should remain 5
            P1: 0,
            PC: 0x05,
            memory: {
                0x06: 5 // RESULT location
            },
            halt: true
        }
    },
    {
        name: "Test Case 3a: Absolute Value (Negative Input)",
        assembly: `
            // Test Case 3a: Absolute Value (Negative Input)
            ORG 10H
            LDA VALUE     // AC = -5 (FFFBBh)
            SETP P1, AC<0 // P1 = 1
            (P1) CMA      // AC = 0004h
            (P1) INC      // AC = 0005h
            STA ABSVAL
            HLT

            VALUE,  DEC -5
            ABSVAL, HEX 0
        `,
        expected: {
            AC: 5,
            P1: 1,
            PC: 0x16, // PC after HLT at 0x15
            memory: {
                "0x17": 5 // Corrected address check for ABSVAL
            },
            halt: true
        }
    },
    {
        name: "Test Case 3b: Absolute Value (Positive Input)",
        assembly: `
            // Test Case 3b: Absolute Value (Positive Input)
            ORG 10H
            LDA VALUE     // AC = 7
            SETP P1, AC<0 // P1 = 0
            (P1) CMA      // Skipped
            (P1) INC      // Skipped
            STA ABSVAL
            HLT

            VALUE,  DEC 7
            ABSVAL, HEX 0
        `,
        expected: {
            AC: 7,
            P1: 0,
            PC: 0x16, // PC after HLT at 0x15
            memory: {
                "0x17": 7 // Corrected address check for ABSVAL
            },
            halt: true
        }
    },
    {
        name: "Test Case 4: Looping with ISZ",
        assembly: `
            // Test Case 4: Looping with ISZ
            ORG 20H
            LDA COUNT     // AC = -3 (FFFDh)
            STA CTR       // M[24h] = FFFDh

            LOOP, ISZ CTR // M[24h] increments: FFFE, FFFF, 0000 (skip on last)
            BUN LOOP      // Branch back

            HLT           // Halt when CTR becomes 0

            COUNT, DEC -3
            CTR,   HEX 0
        `,
        expected: {
            AC: 0xFFFD, // AC still holds initial loaded value
            DR: 0,      // DR holds 0 after last ISZ
            PC: 0x25,   // Corrected PC after HLT
            memory: {
                "0x25": 0 // Corrected address check for CTR
            },
            halt: true
        }
    },
    {
        name: "Test Case 5: Subroutine Call (BSA/BUN I)",
        assembly: `
            // Test Case 5: Subroutine Call (Corrected Layout)
            ORG 30H
            BSA SUB       // Call SUB. M[SUB]=31h. PC=SUB+1
            STA RES       // Store result from AC. AR=RES
            HLT           // Halt

            SUB, HEX 0    // Placeholder for return address
                LDA VAL1  // Subroutine starts here. AC = 100
                ADD VAL2  // AC = 150
                BUN SUB I // Return. PC = M[SUB] = M[40h] = 31h

            ORG 50H       // Data section
            VAL1, DEC 100
            VAL2, DEC 50
            RES,  HEX 0
        `,
        expected: {
            AC: 150,
            PC: 0x33, // Corrected PC after HLT
            AR: 0x52, // AR holds RES address after STA
            memory: {
                "0x40": 0x31, // Return address stored by BSA at SUB
                "0x52": 150   // Result stored in RES
            },
            halt: true
        }
    },
    // Add more tests: Predicated BUN, STA, other conditions for SETP, IO tests (harder to automate fully)
];

// --- Test Runner Logic ---

const runTestsBtn = document.getElementById('runTestsBtn');
const testResultsDiv = document.getElementById('testResults');
const MAX_STEPS = 5000; // Prevent infinite loops in tests

// Function to run the simulator until halt or max steps (Asynchronous)
function runSimulation(maxSteps) {
    return new Promise((resolve) => {
        let steps = 0;

        function runStep() {
            if (!halt && steps < maxSteps) {
                step(); // Execute one step
                steps++;
                setTimeout(runStep, 0); // Schedule next step asynchronously
            } else {
                if (steps >= maxSteps) {
                    console.error("Test reached maximum steps, possible infinite loop.");
                    halt = true; // Force halt if not already
                    statusDiv.textContent = `Status: Halted (Max Steps Reached: ${maxSteps})`;
                }
                resolve(steps); // Resolve the promise when done
            }
        }

        runStep(); // Start the asynchronous loop
    });
}

// Function to compare actual state with expected state
function checkExpected(expected) {
    const results = { pass: true, messages: [] };
    for (const key in expected) {
        let actualValue;
        let expectedValue = expected[key];
        let check = false;

        if (key === 'memory') {
            for (const addrHex in expectedValue) {
                const addr = parseInt(addrHex, 16);
                if (!isNaN(addr) && addr >= 0 && addr < memory.length) {
                    actualValue = memory[addr];
                    const expectedMemValue = expectedValue[addrHex];
                    if (actualValue !== expectedMemValue) {
                        results.pass = false;
                        results.messages.push(`FAIL Memory[${formatHex(addr, 10)}]: Expected ${formatHex(expectedMemValue, 16)}, Got ${formatHex(actualValue, 16)}`);
                    } else {
                        results.messages.push(`PASS Memory[${formatHex(addr, 10)}]: ${formatHex(actualValue, 16)}`);
                    }
                } else {
                    results.pass = false;
                    results.messages.push(`FAIL Memory Check: Invalid address ${addrHex} in expectation.`);
                }
            }
            check = true;
        } else {
            switch (key.toUpperCase()) {
                case 'AC': actualValue = AC; break;
                case 'PC': actualValue = PC; break;
                case 'AR': actualValue = AR; break;
                case 'DR': actualValue = DR; break;
                case 'E': actualValue = E; break;
                case 'P1': actualValue = P1; break;
                case 'P2': actualValue = P2; break;
                case 'P3': actualValue = P3; break;
                case 'HALT': actualValue = halt; break;
                default:
                    results.messages.push(`WARN: Unknown key "${key}" in expected results.`);
                    check = true;
            }
        }

        if (!check) {
            if (actualValue !== expectedValue) {
                const format = (val) => typeof val === 'boolean' ? val : formatHex(val, 16);
                results.pass = false;
                results.messages.push(`FAIL ${key.toUpperCase()}: Expected ${format(expectedValue)}, Got ${format(actualValue)}`);
            } else {
                const format = (val) => typeof val === 'boolean' ? val : formatHex(val, 16);
                results.messages.push(`PASS ${key.toUpperCase()}: ${format(actualValue)}`);
            }
        }
    }
    return results;
}

// Function to run a single test case (needs to be async due to runSimulation)
async function runTest(testCase) {
    console.log(`--- Running Test: ${testCase.name} ---`);
    testResultsDiv.textContent += `Running: ${testCase.name}...\n`;

    reset();

    codeInput.value = testCase.assembly;
    const loadResult = assemble(testCase.assembly);

    if (!loadResult.success) {
        console.error(`Assembly failed for test: ${testCase.name}`);
        testResultsDiv.textContent += `  RESULT: ASSEMBLY FAILED\n${loadResult.errors.join('\n  ')}\n\n`;
        return false;
    }

    currentSymbolTable = loadResult.symbolTable;
    loadResult.machineCode.forEach(entry => {
        if (entry.address >= 0 && entry.address < memory.length) {
            memory[entry.address] = entry.instruction;
        }
    });
    updateMemoryUI();
    updateRegistersUI();

    const steps = await runSimulation(MAX_STEPS);
    console.log(`  Simulation finished in ${steps} steps. Halt state: ${halt}`);

    const check = checkExpected(testCase.expected);

    testResultsDiv.textContent += `  Steps: ${steps}\n`;
    check.messages.forEach(msg => {
        testResultsDiv.textContent += `  ${msg}\n`;
    });
    testResultsDiv.textContent += `  RESULT: ${check.pass ? 'PASSED' : 'FAILED'}\n\n`;
    testResultsDiv.scrollTop = testResultsDiv.scrollHeight;

    console.log(`--- Test ${testCase.name} Result: ${check.pass ? 'PASSED' : 'FAILED'} ---`);
    return check.pass;
}

// Function to run all defined tests (needs to be async)
async function runAllTests() {
    runTestsBtn.disabled = true;
    testResultsDiv.textContent = 'Starting Automated Tests...\n\n';
    let passedCount = 0;
    let failedCount = 0;

    for (const testCase of testCases) {
        const pass = await runTest(testCase);
        if (pass) {
            passedCount++;
        } else {
            failedCount++;
        }
    }

    testResultsDiv.textContent += `--- Test Run Complete ---\nPassed: ${passedCount}\nFailed: ${failedCount}\nTotal: ${testCases.length}\n`;
    testResultsDiv.scrollTop = testResultsDiv.scrollHeight;
    runTestsBtn.disabled = false;
    console.log(`--- Test Run Complete --- Passed: ${passedCount}, Failed: ${failedCount}, Total: ${testCases.length}`);
}

console.log("Tester script loaded.");
