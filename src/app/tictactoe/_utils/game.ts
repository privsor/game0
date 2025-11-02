"use client";

import type { GameState } from "../_types";
import type { Cell } from "../_components/Board";

export function calculateWinner(board: Cell[]): "X" | "O" | "Draw" | null {
  const lines: Array<[number, number, number]> = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  if (board.every(Boolean)) return "Draw";
  return null;
}

export function initialState(): GameState {
  return {
    board: Array<GameState["board"][number]>(9).fill(null) as unknown as GameState["board"],
    next: "X",
    winner: null,
    players: { X: null, O: null },
    names: { X: null, O: null },
    avatars: { X: null, O: null },
  };
}

export function winningLine(board: Cell[]): number[] | null {
  const lines: Array<[number, number, number]> = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return [a, b, c];
    }
  }
  return null;
}
