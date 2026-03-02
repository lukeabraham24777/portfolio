import { create } from 'zustand'

export const useStore = create((set) => ({
  lampOn: true,
  catPosition: 'chair', // 'chair' or 'fireplace'
  view: 'orbit',        // INITIAL STATE: 'orbit' (standing) or 'room' (sitting)
  pcOn: false,          // Computer power state

  toggleLamp: () => set((state) => ({ 
    lampOn: !state.lampOn 
  })),
  
  moveCat: () => set((state) => ({ 
    // RULE: Cat only moves if lamp is on
       catPosition: !state.lampOn ? 'fireplace' : 'chair' 

  })),

  sitDown: () => set((state) => ({ 
    // RULE: Only sit if cat has moved to the fireplace
    view: state.catPosition === 'fireplace' ? 'room' : 'orbit' 
  })),

  standUp: () => set({ 
  view: 'orbit'
}),

  togglePc: () => set((state) => { 
  // RULE: Only toggle if currently sitting
  if (state.view === 'room') {
    return { pcOn: !state.pcOn }
  }
  return {} // Don't change anything if not sitting
})
}))


/*
Sound Effects : basketball swish, wind blow,interact with lamp, walking


Increase snowfall

Glossy Floor

    

Design computer UI
Populate computer




Easter eggs
Experimental graphics: aurora enhanced, shiyunli orb thingy



*/