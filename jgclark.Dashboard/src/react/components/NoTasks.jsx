/* eslint-disable prefer-template */
// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show there are no tasks for today. Called by ItemRow.
// Last updated for v2.1.0.a
//--------------------------------------------------------------------------

import React, { type Node } from 'react'
// import {random} from 'lodash'


/**
 * Component for displaying a message when there are no tasks.
 * TODO: add confetti or something on first display
 */
const NoTasks = (): Node => {
  return (
    <div className="sectionItemRow checkedBackground" data-section-type="">
      <div className="TaskItem checked">
        <i className="checked fa-solid fa-circle-check"></i>
      </div>
      <div className="sectionItemContent sectionItem">
        <div className="checked">
          <i>
            Nothing left on this list: take a break!
            {/* <i className="fa-solid fa-mug pad-left"></i> */}
          </i>
        </div>
      </div>
    </div>
  )
}


//--------------------------------------------------------------------------
// Confetti Cannon
// adapted from https://codepen.io/jscottsmith/pen/VjPaLO
// TODO: what other libraries does this need?
// - https://cdnjs.cloudflare.com/ajax/libs/gsap/1.18.5/TweenLite.min.js
// - https://s3-us-west-2.amazonaws.com/s.cdpn.io/16327/Physics2DPlugin.min.js
// - https://cdnjs.cloudflare.com/ajax/libs/lodash.js/4.13.1/lodash.min.js
// Following code also uses Babel.
//--------------------------------------------------------------------------

// constants
const DECAY = 4     // confetti decay in seconds
const SPREAD = 60   // degrees to spread from the angle of the cannon
const GRAVITY = 1200

// utilities
function getLength(x0: number, y0: number, x1: number, y1: number) {
  // returns the length of a line segment
  const x = x1 - x0
  const y = y1 - y0
  return Math.sqrt(x * x + y * y)
}

function getDegAngle(x0: number, y0: number, x1: number, y1: number) {
  const y = y1 - y0
  const x = x1 - x0
  return Math.atan2(y, x) * (180 / Math.PI)
}

class ConfettiCannon {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  dpr: number // device pixel ratio
  drawVector: boolean
  vector: Array<{ x: number, y: number }>
  pointer: { x: number, y: number }
  confettiSpriteIds: Array<number>
  confettiSprites: Record<number,
    { x: number, y: number, r: number, d: number, angle: number, tilt: number, tiltAngle: number, tiltAngleIncremental: number, color: string }
  >
  timer: TimeoutID

  constructor() {
    // setup a canvas
    this.canvas = document.getElementById('canvas')
    this.dpr = window.devicePixelRatio || 1
    this.ctx = this.canvas.getContext('2d')
    this.ctx.scale(this.dpr, this.dpr)

    // add confetti here
    this.confettiSpriteIds = []
    this.confettiSprites = {}

    // vector line representing the firing angle
    this.drawVector = false
    this.vector = [{
      x: window.innerWidth,
      y: window.innerHeight * 1.25,
    }, {
      x: window.innerWidth,
      y: window.innerHeight * 2,
    }]

    this.pointer = {}

    // bind methods
    this.render = this.render.bind(this)
    this.handleMousedown = this.handleMousedown.bind(this)
    this.handleMouseup = this.handleMouseup.bind(this)
    this.handleMousemove = this.handleMousemove.bind(this)
    this.handleTouchstart = this.handleTouchstart.bind(this)
    this.handleTouchmove = this.handleTouchmove.bind(this)
    this.setCanvasSize = this.setCanvasSize.bind(this)

    this.setupListeners()
    this.setCanvasSize()

    // fire off for a demo
    this.timer = setTimeout(this.handleMouseup, 1000)
  }

  setupListeners() {
    // Use TweenLite tick event for the render loop
    TweenLite.ticker.addEventListener('tick', this.render)

    // bind events
    window.addEventListener('mousedown', this.handleMousedown)
    window.addEventListener('mouseup', this.handleMouseup)
    window.addEventListener('mousemove', this.handleMousemove)
    window.addEventListener('touchstart', this.handleTouchstart)
    window.addEventListener('touchend', this.handleMouseup)
    window.addEventListener('touchmove', this.handleTouchmove)
    window.addEventListener('resize', this.setCanvasSize)
  }

  setCanvasSize() {
    this.canvas.width = window.innerWidth * this.dpr
    this.canvas.height = window.innerHeight * this.dpr
    this.canvas.style.width = window.innerWidth + 'px'
    this.canvas.style.height = window.innerHeight + 'px'
  }

  handleMousedown(event: any) {
    clearTimeout(this.timer)
    const x = event.clientX * this.dpr
    const y = event.clientY * this.dpr

    this.vector[0] = {
      x,
      y,
    }
    this.drawVector = true
  }

  handleTouchstart(event: any): void {
    clearTimeout(this.timer)
    event.preventDefault()
    const x = event.touches[0].clientX * this.dpr
    const y = event.touches[0].clientY * this.dpr
    this.vector[0] = {
      x,
      y,
    }

    this.drawVector = true
  }

  handleMouseup(event: any) {
    this.drawVector = false

    const x0 = this.vector[0].x
    const y0 = this.vector[0].y
    const x1 = this.vector[1].x
    const y1 = this.vector[1].y

    const length = getLength(x0, y0, x1, y1)
    const angle = getDegAngle(x0, y0, x1, y1) + 180

    const particles = length / 5 + 5
    const velocity = length * 10
    this.addConfettiParticles(particles, angle, velocity, x0, y0)
  }

  handleMousemove(event: any) {
    const x = event.clientX * this.dpr
    const y = event.clientY * this.dpr
    this.vector[1] = {
      x,
      y,
    }
    this.pointer = this.vector[1]
  }

  handleTouchmove(event: any) {
    event.preventDefault()
    const x = event.changedTouches[0].clientX * this.dpr
    const y = event.changedTouches[0].clientY * this.dpr
    this.vector[1] = {
      x,
      y,
    }
    this.pointer = this.vector[1]
  }

  drawVectorLine() {
    this.ctx.strokeStyle = 'pink'
    this.ctx.lineWidth = 2 * this.dpr

    const x0 = this.vector[0].x
    const y0 = this.vector[0].y
    const x1 = this.vector[1].x
    const y1 = this.vector[1].y

    this.ctx.beginPath()
    this.ctx.moveTo(x0, y0)
    this.ctx.lineTo(x1, y1)
    this.ctx.stroke()
  }

  addConfettiParticles(amount: number, angle: number, velocity: number, x: number, y: number) {
    let i = 0
    while (i < amount) {
      // sprite
      const r = random(4, 6) * this.dpr
      const d = random(15, 25) * this.dpr

      const cr = random(30, 255)
      const cg = random(30, 230)
      const cb = random(30, 230)
      const color = `rgb(${cr}, ${cg}, ${cb})`

      const tilt = random(10, -10)
      const tiltAngleIncremental = random(0.07, 0.05)
      const tiltAngle = 0

      const id = _.uniqueId()
      const sprite = {
        [id]: {
          angle,
          velocity,
          x,
          y,
          r,
          d,
          color,
          tilt,
          tiltAngleIncremental,
          tiltAngle,
        },
      }

      Object.assign(this.confettiSprites, sprite)
      this.confettiSpriteIds.push(id)
      this.tweenConfettiParticle(id)
      i++
    }
  }

  tweenConfettiParticle(id) {
    const minAngle = this.confettiSprites[id].angle - SPREAD / 2
    const maxAngle = this.confettiSprites[id].angle + SPREAD / 2

    const minVelocity = this.confettiSprites[id].velocity / 4
    const maxVelocity = this.confettiSprites[id].velocity

    // Physics Props
    const velocity = random(minVelocity, maxVelocity)
    const angle = random(minAngle, maxAngle)
    const gravity = GRAVITY
    const friction = random(0.1, 0.25)
    const d = 0

    TweenLite.to(this.confettiSprites[id], DECAY, {
      physics2D: {
        velocity,
        angle,
        gravity,
        friction,
      },
      d,
      ease: Power4.easeIn,
      onComplete: () => {
        // remove confetti sprite and id
        _.pull(this.confettiSpriteIds, id)
        delete this.confettiSprites[id]
      },
    })
  }

  updateConfettiParticle(id) {
    const sprite = this.confettiSprites[id]

    const tiltAngle = 0.0005 * sprite.d

    sprite.angle += 0.01
    sprite.tiltAngle += tiltAngle
    sprite.tiltAngle += sprite.tiltAngleIncremental
    sprite.tilt = (Math.sin(sprite.tiltAngle - (sprite.r / 2))) * sprite.r * 2
    sprite.y += Math.sin(sprite.angle + sprite.r / 2) * 2
    sprite.x += Math.cos(sprite.angle) / 2
  }

  drawConfetti() {
    this.confettiSpriteIds.map(id => {
      const sprite = this.confettiSprites[id]

      this.ctx.beginPath()
      this.ctx.lineWidth = sprite.d / 2
      this.ctx.strokeStyle = sprite.color
      this.ctx.moveTo(sprite.x + sprite.tilt + sprite.r, sprite.y)
      this.ctx.lineTo(sprite.x + sprite.tilt, sprite.y + sprite.tilt + sprite.r)
      this.ctx.stroke()

      this.updateConfettiParticle(id)
    })
  }

  drawPointer() {
    const centerX = this.pointer.x
    const centerY = this.pointer.y
    const radius = 15 * this.dpr

    this.ctx.beginPath()
    this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false)
    this.ctx.fillStyle = 'transparent'
    this.ctx.fill()
    this.ctx.lineWidth = 2 * this.dpr
    this.ctx.strokeStyle = '#ffffff'
    this.ctx.stroke()
  }

  drawPower() {
    const x0 = this.vector[0].x
    const y0 = this.vector[0].y
    const x1 = this.vector[1].x
    const y1 = this.vector[1].y

    const length = getLength(x0, y0, x1, y1)
    const centerX = x0
    const centerY = y0
    const radius = 1 * this.dpr * length / 20

    this.ctx.beginPath()
    this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false)
    this.ctx.fillStyle = 'transparent'
    this.ctx.fill()
    this.ctx.lineWidth = 2 * this.dpr
    this.ctx.strokeStyle = '#333333'
    this.ctx.stroke()
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // only draw the vector when the drawVector flag is on
    this.drawVector && this.drawVectorLine()
    this.drawVector && this.drawPower()

    this.drawPointer()
    this.drawConfetti()
  }
}

// To use we need this and in HTML "<canvas id="canvas"></canvas>"
// const confetti = new ConfettiCannon()

export default NoTasks
