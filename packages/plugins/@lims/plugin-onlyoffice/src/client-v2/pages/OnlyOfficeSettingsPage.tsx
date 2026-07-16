/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React from 'react';
import { Form, Input, Button, Card, Space, message } from 'antd';
import { useFlowContext } from '@nocobase/flow-engine';
import { useRequest } from 'ahooks';
import { useT } from '../locale';

interface OnlyOfficeSettings {
  documentServerUrl: string;
  callbackUrl: string;
}

export default function OnlyOfficeSettingsPage() {
  const ctx = useFlowContext();
  const t = useT();
  const [form] = Form.useForm<OnlyOfficeSettings>();

  const { loading } = useRequest(
    () =>
      ctx.api.request({
        url: 'onlyofficeSettings:get',
        method: 'get',
      }),
    {
      onSuccess(response) {
        if (response?.data?.data) {
          form.setFieldsValue(response.data.data);
        }
      },
    },
  );

  const { run: save, loading: saving } = useRequest(
    (values: OnlyOfficeSettings) =>
      ctx.api.request({
        url: 'onlyofficeSettings:set',
        method: 'post',
        data: values,
      }),
    {
      manual: true,
      onSuccess() {
        message.success(t('Saved successfully'));
      },
      onError() {
        message.error(t('Save failed'));
      },
    },
  );

  const handleSave = async () => {
    const values = await form.validateFields();
    save(values);
  };

  return (
    <Card title={t('OnlyOffice Settings')} loading={loading}>
      <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
        <Form.Item
          label={t('Document Server URL')}
          name="documentServerUrl"
          rules={[{ required: true, message: t('Please enter the Document Server URL') }]}
          help={t('The base URL of your OnlyOffice Document Server, e.g. https://documentserver.example.com')}
        >
          <Input placeholder="https://documentserver.example.com" />
        </Form.Item>

        <Form.Item
          label={t('Callback URL')}
          name="callbackUrl"
          rules={[{ required: true, message: t('Please enter the Callback URL') }]}
          help={t('The callback URL for saving documents, e.g. https://your-app.com/api/onlyoffice/callback')}
        >
          <Input placeholder="https://your-app.com/api/onlyoffice/callback" />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" onClick={handleSave} loading={saving}>
              {t('Save')}
            </Button>
            <Button onClick={() => form.resetFields()}>{t('Reset')}</Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  );
}
