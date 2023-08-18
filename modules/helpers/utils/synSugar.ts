export const spreadingBoolean = (condition: boolean, key: string) => (condition ? { [key]: true } : {})

export const spreadingValue = (value: any, key: string) => (value ? { [key]: value } : {})

export const variableToString = (varObj: Record<string, unknown>) => Object.keys(varObj)[0]

export const emptyArraysCondition = (arrays: Array<any[]>) =>
    arrays.reduce((prev, curr) => curr.length === 0 && prev, true)
