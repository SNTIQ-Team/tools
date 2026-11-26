'use client';

import React, { createContext, useContext, useEffect, useReducer, Dispatch, ReactNode } from 'react';
import { todayGerman } from '@/core/jurisdiction';
import { LATHE_JURISDICTION } from '../jurisdiction';
import { LatheFormData } from '../types';
import { INITIAL_DATA, createInitialData } from '../wizard';

type Action =
  | { type: 'UPDATE_FIELD'; path: string; value: any }
  | { type: 'SET_DATA'; payload: LatheFormData }
  /** The day changed in Berlin: an automatic signing date follows it. */
  | { type: 'REFRESH_AUTO_DATE'; date: string };

export const formReducer = (state: LatheFormData, action: Action): LatheFormData => {
  switch (action.type) {
    case 'UPDATE_FIELD': {
      const newState = structuredClone(state);
      const keys = action.path.split('.');
      let current: any = newState;
      for (let i = 0; i < keys.length - 1; i++) {
        if (current[keys[i]] === undefined || current[keys[i]] === null) {
          // create array slot or object depending on next key
          current[keys[i]] = /^\d+$/.test(keys[i + 1]) ? [] : {};
        }
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = action.value;
      // A date the person sets is theirs: it no longer follows the calendar.
      if (action.path === 'declaration.date') newState.declaration.dateIsAuto = false;
      return newState;
    }
    case 'REFRESH_AUTO_DATE':
      if (!state.declaration.dateIsAuto || state.declaration.date === action.date) return state;
      return { ...state, declaration: { ...state.declaration, date: action.date } };
    case 'SET_DATA':
      return action.payload;
    default:
      return state;
  }
};

interface FormContextType {
  state: LatheFormData;
  dispatch: Dispatch<Action>;
}

const FormContext = createContext<FormContextType>({
  state: INITIAL_DATA,
  dispatch: () => null,
});

export const FormProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(formReducer, undefined, () => createInitialData());
  // Keep an automatic signing date on today in Berlin: a tab left open over
  // midnight, a laptop woken the next morning.
  useEffect(() => {
    const refresh = () => dispatch({ type: 'REFRESH_AUTO_DATE', date: todayGerman(LATHE_JURISDICTION) });
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh); };
  }, []);
  return <FormContext.Provider value={{ state, dispatch }}>{children}</FormContext.Provider>;
};

export const useForm = () => {
  const context = useContext(FormContext);

  const updateField = (path: string, value: any) =>
    context.dispatch({ type: 'UPDATE_FIELD', path, value });

  const setData = (payload: LatheFormData) =>
    context.dispatch({ type: 'SET_DATA', payload });

  const getValue = (path: string) => {
    const keys = path.split('.');
    let current: any = context.state;
    for (const key of keys) {
      if (current === undefined || current === null) return '';
      current = current[key];
    }
    return current ?? '';
  };

  return { data: context.state, updateField, getValue, setData };
};
