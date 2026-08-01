import React from 'react';
import ComposeWidget from './ComposeWidget';

const ComposePost = ({ onPostCreated }) => (
  <ComposeWidget onSuccess={onPostCreated} />
);

export default ComposePost;
