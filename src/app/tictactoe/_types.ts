export type Role = "X" | "O";

export type GameState = {
  board: ("X" | "O" | null)[]; // 9 cells
  next: Role;
  winner: Role | "Draw" | null;
  players?: { X: string | null; O: string | null };
  names?: { X: string | null; O: string | null };
  avatars?: { X: string | null; O: string | null };
  coinsMode?: { X: boolean; O: boolean };
  coinsModePending?: { X: boolean; O: boolean };
  claim?: { amount: number; winnerRole: Role | null; expiresAt: number | null } | null;
};
