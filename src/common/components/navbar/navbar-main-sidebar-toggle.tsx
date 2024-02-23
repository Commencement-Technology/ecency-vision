import React from "react";

interface Props {
  onClick: () => void;
}

export function NavbarMainSidebarToggle({ onClick }: Props) {
  return (
    <div className="h-[40px] min-w-[60px] pl-[30px] cursor-pointer relative" onClick={onClick}>
      <div className="absolute flex gap-1 flex-col top-3.5 left-0">
        <span className="w-[20px] h-[2px] bg-gray-400 dark:bg-gray-700" />
        <span className="w-[20px] h-[2px] bg-gray-400 dark:bg-gray-700" />
        <span className="w-[20px] h-[2px] bg-gray-400 dark:bg-gray-700" />
      </div>
      <img
        src={require("../../img/logo-circle.svg")}
        className="logo relative w-[40px]"
        alt="Logo"
      />
    </div>
  );
}
