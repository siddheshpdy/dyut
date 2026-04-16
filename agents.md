# 🤖 Agent Context: Dyut Board Game

This document provides a high-level overview of the Dyut Board Game project for engineering assistants.

## 1. Project Objective
The goal is to create a digital version of the traditional Indian cross-and-circle board game, "Dyut". It is built as a web application focusing on complex game state management, accurate pathing, and strict adherence to traditional rules.

## 2. Core Technologies
- **Framework:** React
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **State Management:** React `useReducer` for complex, centralized global state handling.

## 3. Architecture & Core Systems
The game relies heavily on centralized state management due to complex inter-dependencies between dice rolls, piece positions, and player turns.
- **Dice Engine:** Custom dice roller using long dice (Pasa) with strictly faces `[1, 3, 4, 6]`. Handles logic for "Doubles Streaks" and the "Void Rule" (1+3).
- **Movement Priority Engine:** Enforces the critical "Max Value Rule" where players must prioritize moving the sum of dice, then the higher die, then the lower die if paths are blocked.
- **Board Pathing:** A 1D logical track mapped to a 2D cross-shaped board (four 3x8 arms). 
- **Combat & Collision:** Includes Safe Zones ('X'), Pair Shields (two pieces of the same color forming a blockade), and an "Assassin" breach rule for freshly spawned pieces.

## 4. AI Agent Directives & Constraints
To ensure codebase stability, predictability, and high code quality, all AI agents and coding assistants MUST adhere to the following strict constraints when generating responses, updating code, or designing functionality:

### 4.1. Plan-First Approach
* **Always formulate a plan first.** Before writing or outputting any code modifications, you must explicitly outline a clear, step-by-step plan of action based on the user's request.
* Think step-by-step about how the requested changes interact with the complex game state and priority engines before proposing diffs.
* **Explain the "Why".** For every code modification or architecture change proposed in your plan, you must explicitly explain *why* it is necessary to fulfill the user's request. Avoid arbitrary or unexplained refactors.

### 4.2. Strict Scope Containment (No Unnecessary Changes)
* **Modify only what is requested.** Do not refactor, rewrite, reformat, or "clean up" adjacent code that falls outside the explicit scope of the user's prompt.
* Do not alter existing logic, variable names, or file structures unless it is absolutely necessary to fulfill the prompt.
* Keep code diffs as minimal, localized, and targeted as possible.

### 4.3. Anti-Hallucination & Reality Check
* **Do not guess game rules.** Always refer strictly to `LogicAndRules.md` for game mechanics.
* **Do not assume standard Ludo rules.** Dyut has unique mechanics (e.g., Blood Debt, specific dice values, Pair Shields, Assassin Rule). If a rule isn't explicit in `LogicAndRules.md`, ask the user for clarification before assuming standard board game behavior.