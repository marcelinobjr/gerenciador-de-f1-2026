/// <reference types="vite/client" />

// Declarações auxiliares para evitar erros transitórios de tipagem antes da execução de scripts de patch
declare const setHasRaceFinished: ((val: boolean) => void) | undefined
declare const setHasQualyFinished: ((val: boolean) => void) | undefined
declare const setPracticeDone: ((val: boolean) => void) | undefined
