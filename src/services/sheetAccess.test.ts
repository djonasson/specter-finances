// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getGrantedSheetId,
  setGrantedSheetId,
  clearGrantedSheetId,
  setSheetAccessListener,
  SheetAccessError,
} from './sheetAccess';

// Added retroactively: this module had no tests, and it is the hinge the whole
// error model turns on. Every 403/404 from the Sheets API comes through here,
// and getting it wrong either strands the user at the picker or leaves them
// staring at a sheet the app can no longer read.

afterEach(() => {
  setSheetAccessListener(null);
  localStorage.clear();
});

describe('the granted sheet', () => {
  it('remembers the sheet the user picked', () => {
    setGrantedSheetId('sheet-1');
    expect(getGrantedSheetId()).toBe('sheet-1');
  });

  it('reports no sheet before anything has been picked', () => {
    expect(getGrantedSheetId()).toBeNull();
  });

  it('survives a reload, which is the whole point of storing it', () => {
    setGrantedSheetId('sheet-1');
    // Nothing in memory is consulted — the value comes back out of storage.
    expect(localStorage.getItem('sf_granted_sheet')).toBe('sheet-1');
  });

  it('replaces the previous sheet rather than accumulating', () => {
    setGrantedSheetId('sheet-1');
    setGrantedSheetId('sheet-2');
    expect(getGrantedSheetId()).toBe('sheet-2');
  });

  it('forgets the sheet when access is lost', () => {
    setGrantedSheetId('sheet-1');
    clearGrantedSheetId();
    expect(getGrantedSheetId()).toBeNull();
  });
});

describe('the access listener', () => {
  it('hears which sheet was picked', () => {
    const heard = vi.fn();
    setSheetAccessListener(heard);
    setGrantedSheetId('sheet-1');
    expect(heard).toHaveBeenCalledWith('sheet-1');
  });

  // Bouncing back to the picker with no explanation leaves the user re-picking
  // the same sheet forever, so the reason has to travel with the clear.
  it('carries the reason the grant was dropped', () => {
    const heard = vi.fn();
    setSheetAccessListener(heard);
    clearGrantedSheetId('Cannot reach spreadsheet abc (Not found).');
    expect(heard).toHaveBeenCalledWith(null, 'Cannot reach spreadsheet abc (Not found).');
  });

  it('reports a drop with no reason as a drop all the same', () => {
    const heard = vi.fn();
    setSheetAccessListener(heard);
    clearGrantedSheetId();
    expect(heard).toHaveBeenCalledWith(null, undefined);
  });

  it('keeps only the most recent listener, since there is one gate', () => {
    const first = vi.fn();
    const second = vi.fn();
    setSheetAccessListener(first);
    setSheetAccessListener(second);
    setGrantedSheetId('sheet-1');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('sheet-1');
  });

  it('stops reporting once detached, so an unmounted gate is not called', () => {
    const heard = vi.fn();
    setSheetAccessListener(heard);
    setSheetAccessListener(null);
    setGrantedSheetId('sheet-1');
    clearGrantedSheetId();
    expect(heard).not.toHaveBeenCalled();
  });

  it('still records the change when nobody is listening', () => {
    setGrantedSheetId('sheet-1');
    expect(getGrantedSheetId()).toBe('sheet-1');
  });
});

describe('SheetAccessError', () => {
  // The name is what the app tells "the grant is gone, go back to the picker"
  // apart from an ordinary failure worth showing in a banner.
  it('is an Error that identifies itself by name', () => {
    const e = new SheetAccessError('No spreadsheet selected');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('SheetAccessError');
    expect(e.message).toBe('No spreadsheet selected');
  });
});
