import React from 'react';
import ReactDOM from 'react-dom';
import LoadingContainer from './LoadingContainer';
import reportWebVitals from './reportWebVitals';
import './scss/index.scss';
ReactDOM.render(
  <React.StrictMode>
    <LoadingContainer />
  </React.StrictMode>,
  document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
