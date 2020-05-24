export interface State {
    val: number
}

export enum ActionTypes {
    SET_COUNTER = '@counter/SET_COUNTER',
    INCREMENT_COUNTER = '@counter/INCREMENT_COUNTER',
    DECREMENT_COUNTER = '@counter/DECREMENT_COUNTER',
}

export interface IncrementAction {
    type: ActionTypes.INCREMENT_COUNTER;
}

export interface DecrementAction {
    type: ActionTypes.DECREMENT_COUNTER;
}

export type Actions = IncrementAction | DecrementAction
