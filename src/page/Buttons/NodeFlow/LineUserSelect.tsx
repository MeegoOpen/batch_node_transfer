import React, { memo } from "react";
import { UserSelect } from "@lark-project/ui-kit-plugin";
import { withField } from "@douyinfe/semi-ui";

const LineUserSelect = memo(
  (props: { multiple?: boolean; value: string[]; onChange?: (value: string[]) => void }) => {
    const { value, onChange, multiple = true } = props;
    return (
      <UserSelect
        multiple={multiple}
        showClear
        maxTagCount={2}
        placeholder={"请选择"}
        userIds={value}
        onChange={(ids) => {
          onChange?.(ids)
        }}
      />
    );
  }
);

export default withField(LineUserSelect, {
  valueKey: "value",
  onKeyChangeFnName: "onChange",
});
