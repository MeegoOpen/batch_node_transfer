import React, { memo, useMemo } from "react";
import { Tooltip, Form } from "@douyinfe/semi-ui";
import { IconInfoCircle } from "@douyinfe/semi-icons";
import LineUserSelect from "../LineUserSelect";
import RichTextEditorCom from "./RichTextEditor";

const ItemCol = (props) => {
  const { Input, TextArea, Select, RadioGroup, Radio } = Form;
  const {
    fieldList,
    workItemId,
    requiredFields = [],
    spaceId,
    workObjectId,
    formApi,
    workItemName = "",
  } = props;
  const { field_key } = props?.item;

  const curField = useMemo(() => {
    return fieldList.find((i) => i.field_key === field_key);
  }, [field_key]);

  const label = useMemo(() => {
    return curField?.field_name;
  }, [curField]);

  const required = useMemo(() => {
    return requiredFields.includes(field_key);
  }, [field_key, requiredFields]);

  switch (curField?.field_type_key) {
    case "text":
      return (
        <Input
          label={{ text: label, required }}
          field={`${workItemId}.${field_key}`}
        />
      );
    case "multi_pure_text":
      return (
        <TextArea
          autosize
          rows={1}
          label={{ text: label, required }}
          field={`${workItemId}.${field_key}`}
        />
      );
    case "select":
      return (
        <Select
          label={{
            text: label,
            required,
          }}
          multiple={false}
          field={`${workItemId}.${field_key}`}
          optionList={curField?.options}
        />
      );
    case "multi_select":
      return (
        <Select
          label={{ text: label, required }}
          multiple
          field={`${workItemId}.${field_key}`}
          optionList={curField?.options}
        />
      );
    case "multi_user":
      return (
        <LineUserSelect
          label={{ text: label, required }}
          field={`${workItemId}.${field_key}`}
        />
      );
    case "user":
      return (
        <LineUserSelect
          label={{ text: label, required }}
          field={`${workItemId}.${field_key}`}
          multiple={false}
        />
      );
    case "radio":
      return (
        <RadioGroup
          field={`${workItemId}.${field_key}`}
          label={{ text: label, required }}
        >
          {curField?.options.map((i) => (
            <Radio value={i.value}>{i.label}</Radio>
          ))}
        </RadioGroup>
      );
    case "bool":
      return (
        <RadioGroup
          field={`${workItemId}.${field_key}`}
          label={{ text: label, required }}
        >
          {[
            {
              value: true,
              label: "是",
            },
            {
              value: false,
              label: "否",
            },
          ].map((i) => (
            <Radio value={i.value}>{i.label}</Radio>
          ))}
        </RadioGroup>
      );
    case "multi_text": {
      const record = formApi?.getValue(`${workItemId}.${field_key}`);
      return (
        <Form.Slot label={{ text: label, required }}>
          <div>
            <RichTextEditorCom
              data={record}
              index={0}
              cellIndex={0}
              onChange={(val) => {
                formApi?.setValue(`${workItemId}.${field_key}`, val);
              }}
              spaceId={spaceId}
              workObjectId={workObjectId}
              workItemId={workItemId}
              fieldKey={curField?.field_key}
            />
          </div>
        </Form.Slot>
      );
    }
    default:
      return (
        <Form.Slot
          label={{
            text: label,
            extra: (
              <Tooltip content="该字段类型的修改，可能会导致批量流转失败">
                <IconInfoCircle style={{ marginLeft: 5 }} />
              </Tooltip>
            ),
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", height: "100%" }}
          >
            {`请在【${workItemName}】中进行修改`}
          </div>
        </Form.Slot>
      );
  }
};

export default memo(ItemCol);
