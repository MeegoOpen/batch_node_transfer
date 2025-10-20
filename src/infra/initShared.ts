import React from 'react';
import ReactDOM from 'react-dom';

export function initShared() {
  return window.JSSDK.shared.setSharedModules({
    React,
    ReactDOM,
  });
}
