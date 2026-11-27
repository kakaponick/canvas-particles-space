#!/usr/bin/env node
// Takes away a task's worktree once its branch is on master (CLAUDE.md, "Working here"):
//
//   node scripts/worktree.mjs drop <worktree>
//
// stops its dev server (its own scripts/screen.mjs stop), removes its node_modules without walking a
// junction, then `git worktree remove --force` and `git branch -d` of its branch, which git refuses while
// the branch is not merged. Run it from the main checkout or any other worktree but the one it drops.
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

// Takes a folder away without following a link or a junction inside it: pnpm's node_modules is full of
// junctions, and a removal that walks one empties the folder it points at
export function removeTree (target) {
  const stat = fs.lstatSync(target, { throwIfNoEntry: false })
  if (!stat) return
  if (stat.isSymbolicLink()) {
    try {
      fs.unlinkSync(target)
    } catch {
      fs.rmdirSync(target)
    }
    return
  }
  if (!stat.isDirectory()) return fs.unlinkSync(target)
  for (const name of fs.readdirSync(target)) removeTree(path.join(target, name))
  fs.rmdirSync(target)
}

function drop (given) {
  const tree = path.resolve(given)
  const here = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  if (tree === here) throw new Error(`Run this from another checkout than ${tree}`)
  const git = (...args) => execFileSync('git', args, { cwd: here, encoding: 'utf8' }).trim()
  const branch = git('-C', tree, 'branch', '--show-current')
  const screen = path.join(tree, 'scripts', 'screen.mjs')
  if (fs.existsSync(screen)) {
    try {
      execFileSync(process.execPath, [screen, 'stop'], { cwd: tree, stdio: 'inherit' })
    } catch {
      // No dev server was known for it, or it had already stopped
    }
  }
  removeTree(path.join(tree, 'node_modules'))
  git('worktree', 'remove', '--force', tree)
  console.log(`removed ${tree}`)
  if (!branch) return
  try {
    git('branch', '-d', branch)
    console.log(`deleted branch ${branch}`)
  } catch {
    console.log(`kept branch ${branch}: it is not merged`)
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [command, tree] = process.argv.slice(2)
  if (command !== 'drop' || !tree) {
    console.error('node scripts/worktree.mjs drop <worktree>')
    process.exit(2)
  }
  drop(tree)
}
