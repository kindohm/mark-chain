/**
 * UI types and focus management
 */

export type FocusSection =
    | 'targetList'
    | 'rowOps';

export interface FocusState {
    section: FocusSection;
    targetIndex: number; // Only meaningful in targetList
}

export interface AppState {
    focus: FocusState;
    showHelp: boolean;
}
