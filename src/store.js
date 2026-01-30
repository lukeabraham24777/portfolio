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
Sound Effects : fireplace crackle, wind blow, cat stir, cat purr, interact with lamp, interact with chair, walking
Music

Lock WASD movement when sitting down

Make cat look more like a cat

Increase snowfall

Glossy Floor

Intro Menus: 
    -slow blinking as if waking up
    -wasd and look around with mouse instructions
    -spacebar to interact with computer
    -esc/spacebar to exit computer
    -task list : lamp, cat, sit, computer
    -some sort of indicator to show user where to go
    
Easter eggs




Design computer UI
Populate computer









Experimental graphics: aurora enhanced, 
Custom Objects: basketball, 


Purchase Domain and Host

*/